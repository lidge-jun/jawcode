use std::{
	collections::{BTreeSet, HashMap, HashSet},
	path::{Path, PathBuf},
};

use anyhow::{Result, anyhow};
use ast_grep_core::tree_sitter::LanguageExt;
use ignore::{DirEntry, WalkBuilder};
use tree_sitter::{Parser, Query, QueryCursor, StreamingIterator};

use crate::{SupportLang, ops::resolve_language};

const DEFAULT_TOKEN_BUDGET: usize = 4096;
const PAGERANK_ITERATIONS: usize = 24;
const PAGERANK_DAMPING: f64 = 0.85;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TagKind {
	Definition,
	Reference,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tag {
	pub kind:     String,
	pub name:     String,
	pub line:     usize,
	pub tag_kind: TagKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileTags {
	pub path:        PathBuf,
	pub language:    SupportLang,
	pub definitions: Vec<Tag>,
	pub references:  Vec<Tag>,
}

#[derive(Debug, Clone)]
struct RankedFile {
	relative_path: String,
	score:         f64,
	definitions:   Vec<Tag>,
}

pub fn extract_tags(path: impl AsRef<Path>) -> Result<FileTags> {
	let path = path.as_ref();
	let source = std::fs::read_to_string(path)
		.map_err(|err| anyhow!("Failed to read {}: {err}", path.display()))?;
	extract_tags_from_source(path, &source)
}

pub fn repo_map(path: impl AsRef<Path>, budget: Option<usize>) -> Result<String> {
	let root = normalize_root(path.as_ref())?;
	let files = collect_supported_files(&root);
	let mut tagged_files = Vec::new();
	for file in files {
		if let Ok(tags) = extract_tags(&file)
			&& !tags.definitions.is_empty()
		{
			tagged_files.push(tags);
		}
	}

	let budget = budget.unwrap_or(DEFAULT_TOKEN_BUDGET).max(64);
	let relative_base = if root.is_file() {
		root.parent().unwrap_or(&root)
	} else {
		root.as_path()
	};
	let mut ranked = rank_files(relative_base, tagged_files);
	let mut lines = vec![format!("# Repo map: {}", root.display())];
	if ranked.is_empty() {
		lines.push("No tree-sitter tags found.".to_string());
		return Ok(lines.join("\n"));
	}

	ranked.sort_by(|left, right| {
		right
			.score
			.total_cmp(&left.score)
			.then(left.relative_path.cmp(&right.relative_path))
	});

	let mut rendered = String::new();
	for line in lines {
		push_budgeted_line(&mut rendered, &line, budget);
	}
	for file in ranked {
		let header = format!("\n## {}  score:{:.4}", file.relative_path, file.score);
		if !push_budgeted_line(&mut rendered, &header, budget) {
			break;
		}
		for tag in file.definitions {
			let line = format!("{}:{} {}", tag.line, tag.kind, tag.name);
			if !push_budgeted_line(&mut rendered, &line, budget) {
				return Ok(rendered.trim_end().to_string());
			}
		}
	}
	Ok(rendered.trim_end().to_string())
}

fn extract_tags_from_source(path: &Path, source: &str) -> Result<FileTags> {
	let language = resolve_language(None, path)?;
	let query_source = tags_query(language)
		.ok_or_else(|| anyhow!("No tags query for language {}", language.canonical_name()))?;
	let ts_language = language.get_ts_language();
	let mut parser = Parser::new();
	parser.set_language(&ts_language).map_err(|err| {
		anyhow!("Failed to initialize parser for {}: {err}", language.canonical_name())
	})?;
	let tree = parser
		.parse(source, None)
		.ok_or_else(|| anyhow!("Failed to parse {}", path.display()))?;
	let query = Query::new(&ts_language, query_source)
		.map_err(|err| anyhow!("Invalid tags query for {}: {err}", language.canonical_name()))?;
	let mut cursor = QueryCursor::new();
	let capture_names = query.capture_names();
	let mut definitions = Vec::new();
	let mut references = Vec::new();
	let source_bytes = source.as_bytes();

	let mut matches = cursor.matches(&query, tree.root_node(), source_bytes);
	while let Some(query_match) = matches.next() {
		let mut def_kind = None;
		let mut ref_kind = None;
		let mut def_name = None;
		let mut ref_name = None;
		for capture in query_match.captures {
			let capture_name = capture_names[capture.index as usize];
			if let Some(kind) = capture_name.strip_prefix("definition.") {
				def_kind = Some(kind.to_string());
			} else if let Some(kind) = capture_name.strip_prefix("reference.") {
				ref_kind = Some(kind.to_string());
			} else if capture_name.starts_with("name.definition.") {
				def_name = Some(tag_from_capture(capture_name, capture.node, source_bytes));
			} else if capture_name.starts_with("name.reference.") {
				ref_name = Some(tag_from_capture(capture_name, capture.node, source_bytes));
			}
		}
		if let Some(mut tag) = def_name {
			if let Some(kind) = def_kind {
				tag.kind = kind;
			}
			definitions.push(tag);
		}
		if let Some(mut tag) = ref_name {
			if let Some(kind) = ref_kind {
				tag.kind = kind;
			}
			references.push(tag);
		}
	}

	dedup_tags(&mut definitions);
	dedup_tags(&mut references);
	Ok(FileTags { path: path.to_path_buf(), language, definitions, references })
}

fn tag_from_capture(capture_name: &str, node: tree_sitter::Node<'_>, source: &[u8]) -> Tag {
	let kind = capture_name
		.rsplit_once('.')
		.map_or("symbol", |(_, kind)| kind)
		.to_string();
	let name = node.utf8_text(source).unwrap_or("").trim().to_string();
	Tag { kind, name, line: node.start_position().row + 1, tag_kind: capture_kind(capture_name) }
}

fn capture_kind(capture_name: &str) -> TagKind {
	if capture_name.starts_with("name.reference.") {
		TagKind::Reference
	} else {
		TagKind::Definition
	}
}

fn dedup_tags(tags: &mut Vec<Tag>) {
	let mut seen = BTreeSet::new();
	tags.retain(|tag| seen.insert((tag.line, tag.kind.clone(), tag.name.clone())));
	tags.sort_by(|left, right| {
		left
			.line
			.cmp(&right.line)
			.then(left.kind.cmp(&right.kind))
			.then(left.name.cmp(&right.name))
	});
}

const fn tags_query(language: SupportLang) -> Option<&'static str> {
	match language {
		SupportLang::JavaScript => Some(include_str!("../resources/tags/javascript.scm")),
		SupportLang::Rust => Some(include_str!("../resources/tags/rust.scm")),
		SupportLang::Tsx => Some(include_str!("../resources/tags/tsx.scm")),
		SupportLang::TypeScript => Some(include_str!("../resources/tags/typescript.scm")),
		_ => None,
	}
}

fn normalize_root(path: &Path) -> Result<PathBuf> {
	let absolute = if path.is_absolute() {
		path.to_path_buf()
	} else {
		std::env::current_dir()?.join(path)
	};
	std::fs::canonicalize(&absolute)
		.map_err(|err| anyhow!("Map path not found {}: {err}", absolute.display()))
}

fn collect_supported_files(root: &Path) -> Vec<PathBuf> {
	if root.is_file() {
		return resolve_language(None, root)
			.is_ok()
			.then(|| root.to_path_buf())
			.into_iter()
			.collect();
	}
	let mut builder = WalkBuilder::new(root);
	builder
		.hidden(false)
		.git_ignore(true)
		.git_global(true)
		.git_exclude(true)
		.filter_entry(should_descend);
	let mut files = Vec::new();
	for entry in builder.build().filter_map(Result::ok) {
		if entry
			.file_type()
			.is_some_and(|file_type| file_type.is_file())
			&& resolve_language(None, entry.path()).is_ok()
			&& tags_query(resolve_language(None, entry.path()).expect("checked language")).is_some()
		{
			files.push(entry.into_path());
		}
	}
	files.sort();
	files
}

fn should_descend(entry: &DirEntry) -> bool {
	let Some(name) = entry.file_name().to_str() else {
		return true;
	};
	if entry.depth() == 0 {
		return true;
	}
	if name.starts_with('.') {
		return false;
	}
	!matches!(name, ".git" | "node_modules" | "dist" | "build" | "target" | "out" | "coverage")
}

fn rank_files(root: &Path, files: Vec<FileTags>) -> Vec<RankedFile> {
	let mut symbol_definers: HashMap<String, Vec<usize>> = HashMap::new();
	for (index, file) in files.iter().enumerate() {
		for def in &file.definitions {
			symbol_definers
				.entry(def.name.clone())
				.or_default()
				.push(index);
		}
	}

	let mut outgoing: Vec<HashSet<usize>> = vec![HashSet::new(); files.len()];
	let mut ref_counts = vec![0usize; files.len()];
	for (referencer, file) in files.iter().enumerate() {
		for reference in &file.references {
			let Some(definers) = symbol_definers.get(&reference.name) else {
				continue;
			};
			for &definer in definers {
				ref_counts[definer] = ref_counts[definer].saturating_add(1);
				if definer != referencer {
					outgoing[referencer].insert(definer);
				}
			}
		}
	}

	let scores = if files.len() > 1 && outgoing.iter().any(|edges| !edges.is_empty()) {
		pagerank(&outgoing)
	} else {
		ref_count_scores(&ref_counts)
	};

	files
		.into_iter()
		.enumerate()
		.map(|(index, file)| RankedFile {
			relative_path: file
				.path
				.strip_prefix(root)
				.unwrap_or(&file.path)
				.to_string_lossy()
				.replace('\\', "/"),
			score:         scores.get(index).copied().unwrap_or(0.0),
			definitions:   file.definitions,
		})
		.collect()
}

fn pagerank(outgoing: &[HashSet<usize>]) -> Vec<f64> {
	let node_count = outgoing.len();
	if node_count == 0 {
		return Vec::new();
	}
	let n = node_count as f64;
	let base = (1.0 - PAGERANK_DAMPING) / n;
	let mut ranks = vec![1.0 / n; node_count];
	for _ in 0..PAGERANK_ITERATIONS {
		let mut next = vec![base; node_count];
		for (source, targets) in outgoing.iter().enumerate() {
			if targets.is_empty() {
				let share = PAGERANK_DAMPING * ranks[source] / n;
				for score in &mut next {
					*score += share;
				}
				continue;
			}
			let share = PAGERANK_DAMPING * ranks[source] / targets.len() as f64;
			for &target in targets {
				next[target] += share;
			}
		}
		ranks = next;
	}
	ranks
}

fn ref_count_scores(ref_counts: &[usize]) -> Vec<f64> {
	let max = ref_counts.iter().copied().max().unwrap_or(0).max(1) as f64;
	ref_counts
		.iter()
		.map(|count| (*count as f64 + 1.0) / max)
		.collect()
}

fn push_budgeted_line(output: &mut String, line: &str, budget: usize) -> bool {
	let projected = output.len().saturating_add(line.len()).saturating_add(1);
	if projected / 4 > budget {
		return false;
	}
	output.push_str(line);
	output.push('\n');
	true
}

#[cfg(test)]
mod tests {
	use std::{
		fs,
		path::PathBuf,
		time::{SystemTime, UNIX_EPOCH},
	};

	use super::{TagKind, extract_tags, repo_map};

	#[test]
	fn extracts_typescript_defs_and_refs() {
		let dir = temp_dir("ts-tags");
		let file = dir.join("sample.ts");
		fs::write(
			&file,
			"export class Widget {}\nfunction makeWidget(): Widget { return new Widget(); \
			 }\nmakeWidget();\n",
		)
		.expect("write fixture");

		let tags = extract_tags(&file).expect("extract tags");
		assert!(
			tags
				.definitions
				.iter()
				.any(|tag| tag.name == "Widget" && tag.tag_kind == TagKind::Definition)
		);
		assert!(tags.definitions.iter().any(|tag| tag.name == "makeWidget"));
		assert!(tags.references.iter().any(|tag| tag.name == "Widget"));
		fs::remove_dir_all(&dir).ok();
	}

	#[test]
	fn extracts_rust_defs_and_repo_map_output() {
		let dir = temp_dir("rust-tags");
		let file = dir.join("lib.rs");
		fs::write(&file, "pub struct Engine;\npub fn run() { helper(); }\nfn helper() {}\n")
			.expect("write fixture");

		let tags = extract_tags(&file).expect("extract tags");
		assert!(tags.definitions.iter().any(|tag| tag.name == "Engine"));
		assert!(tags.definitions.iter().any(|tag| tag.name == "run"));
		assert!(tags.references.iter().any(|tag| tag.name == "helper"));

		let rendered = repo_map(&dir, Some(256)).expect("repo map");
		assert!(rendered.contains("lib.rs"));
		assert!(rendered.contains("Engine"));
		assert!(rendered.contains("run"));
		fs::remove_dir_all(&dir).ok();
	}

	fn temp_dir(label: &str) -> PathBuf {
		let nonce = SystemTime::now()
			.duration_since(UNIX_EPOCH)
			.expect("clock")
			.as_nanos();
		let dir = std::env::temp_dir().join(format!("pi-ast-{label}-{nonce}"));
		fs::create_dir_all(&dir).expect("create temp dir");
		dir
	}
}
