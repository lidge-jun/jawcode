//! Token counting with provider-aware encodings.
//!
//! Encodings:
//!   - `O200kBase` — GPT-4o / o1 / GPT-5 (default).
//!   - `Cl100kBase` — GPT-3.5 / GPT-4 / older models.
//!   - `Claude` — Anthropic Claude ≤4.6 (embedded `HuggingFace` tokenizers).
//!   - `ClaudeV2` — Anthropic Claude ≥4.7 (V1 × 1.3 correction).
//!   - `Gemma`, `Llama3`, `DeepSeek`, `Mistral`, `Glm`, `Cohere` — lazy-loaded
//!     from `~/.jwc/tokenizers/<family>/tokenizer.json`.
//!
//! tiktoken BPE tables and the Claude V1 tokenizer are embedded in the binary.
//! Other tokenizers are loaded from disk on first use and cached in memory.

use std::{path::PathBuf, sync::LazyLock};

use dashmap::DashMap;
use napi::bindgen_prelude::Either;
use napi_derive::napi;
use rayon::prelude::*;
use tiktoken_rs::{CoreBPE, cl100k_base, o200k_base};
use tokenizers::Tokenizer;

/// Tokenizer encoding to use.
#[napi(string_enum)]
pub enum Encoding {
	/// GPT-4o / o1 / GPT-5 (default).
	O200kBase,
	/// GPT-3.5 / GPT-4 / older.
	Cl100kBase,
	/// Anthropic Claude ≤4.6.
	Claude,
	/// Anthropic Claude ≥4.7 (V1 × 1.3 correction).
	ClaudeV2,
	/// Google Gemini (gemma tokenizer).
	Gemma,
	/// Meta Llama 3.x.
	Llama3,
	/// `DeepSeek` V3/R1.
	DeepSeek,
	/// Mistral/Mixtral.
	Mistral,
	/// GLM-4/5 (Zhipu).
	Glm,
	/// Cohere Command R.
	Cohere,
}

static O200K: LazyLock<CoreBPE> =
	LazyLock::new(|| o200k_base().expect("failed to initialize o200k_base BPE tables"));

static CL100K: LazyLock<CoreBPE> =
	LazyLock::new(|| cl100k_base().expect("failed to initialize cl100k_base BPE tables"));

static CLAUDE_V1: LazyLock<Tokenizer> = LazyLock::new(|| {
	let bytes = include_bytes!("../data/claude.json");
	Tokenizer::from_bytes(bytes).expect("failed to load Claude V1 tokenizer")
});

static LAZY_TOKENIZERS: LazyLock<DashMap<String, Tokenizer>> = LazyLock::new(DashMap::new);

fn tokenizer_dir() -> Option<PathBuf> {
	let home = std::env::var("HOME").ok()?;
	Some(PathBuf::from(home).join(".jwc").join("tokenizers"))
}

fn encoding_to_family(encoding: &Encoding) -> &'static str {
	match encoding {
		Encoding::Gemma => "gemma",
		Encoding::Llama3 => "llama3",
		Encoding::DeepSeek => "deepseek",
		Encoding::Mistral => "mistral",
		Encoding::Glm => "glm",
		Encoding::Cohere => "cohere",
		_ => unreachable!(),
	}
}

fn get_lazy_tokenizer(
	encoding: &Encoding,
) -> Option<dashmap::mapref::one::Ref<'_, String, Tokenizer>> {
	let family = encoding_to_family(encoding);

	if let Some(entry) = LAZY_TOKENIZERS.get(family) {
		return Some(entry);
	}

	let dir = tokenizer_dir()?;
	let path = dir.join(family).join("tokenizer.json");
	if !path.exists() {
		return None;
	}

	let tokenizer = Tokenizer::from_file(&path).ok()?;
	LAZY_TOKENIZERS.insert(family.to_string(), tokenizer);
	LAZY_TOKENIZERS.get(family)
}

fn count_tiktoken(text: &str, encoding: &Encoding) -> u32 {
	let bpe: &CoreBPE = match encoding {
		Encoding::O200kBase => &O200K,
		Encoding::Cl100kBase => &CL100K,
		_ => unreachable!(),
	};
	bpe.encode_ordinary(text).len() as u32
}

fn count_claude(text: &str) -> u32 {
	CLAUDE_V1
		.encode(text, false)
		.expect("claude encode failed")
		.len() as u32
}

fn count_lazy(text: &str, encoding: &Encoding) -> u32 {
	match get_lazy_tokenizer(encoding) {
		Some(tok) => tok
			.encode(text, false)
			.map_or_else(|_| count_tiktoken(text, &Encoding::O200kBase), |enc| enc.len() as u32),
		None => count_tiktoken(text, &Encoding::O200kBase),
	}
}

fn count_one(text: &str, encoding: &Encoding) -> u32 {
	match encoding {
		Encoding::O200kBase | Encoding::Cl100kBase => count_tiktoken(text, encoding),
		Encoding::Claude => count_claude(text),
		Encoding::ClaudeV2 => (f64::from(count_claude(text)) * 1.3).ceil() as u32,
		Encoding::Gemma
		| Encoding::Llama3
		| Encoding::DeepSeek
		| Encoding::Mistral
		| Encoding::Glm
		| Encoding::Cohere => count_lazy(text, encoding),
	}
}

/// Count tokens in `input`.
///
/// `input` may be a single string or an array of strings; an array returns
/// the sum across all elements (encoded in parallel via rayon). Always
/// returns a single token total — use this for any aggregate budget question
/// without paying a per-element napi crossing.
///
/// Uses ordinary encoding (no special-token handling), which is the right
/// choice for measuring user/model content rather than wire-protocol tokens.
/// Defaults to `o200k_base`; pass the appropriate encoding for other providers.
#[napi]
pub fn count_tokens(input: Either<String, Vec<String>>, encoding: Option<Encoding>) -> u32 {
	let enc = encoding.unwrap_or(Encoding::O200kBase);
	match input {
		Either::A(text) => count_one(&text, &enc),
		Either::B(texts) => texts.par_iter().map(|s| count_one(s, &enc)).sum(),
	}
}
