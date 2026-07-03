//! TTY size introspection.
//!
//! `process.stdout.columns` only updates after the JS runtime processes
//! SIGWINCH; a render firing inside that gap sizes lines for the OLD width
//! (the resize-race corruption class, 260703 WP4). This module reads the
//! size straight from the kernel so render-time dimensions are always true.

use napi_derive::napi;

/// Terminal size as reported by the kernel (`TIOCGWINSZ`).
#[napi(object)]
pub struct TtyWinsize {
	/// Rows in character cells.
	pub rows: u32,
	/// Columns in character cells.
	pub cols: u32,
}

/// Read the CURRENT terminal size for `fd` directly from the kernel.
///
/// Returns `null` when `fd` is not a TTY, the ioctl fails, the reported
/// size is degenerate (0 rows/cols), or the platform has no `TIOCGWINSZ`.
#[napi]
pub fn get_tty_winsize(fd: i32) -> Option<TtyWinsize> {
	#[cfg(unix)]
	{
		// SAFETY: `libc::winsize` is a plain C POD struct; the zero value is a
		// valid initialized placeholder before `ioctl` fills it.
		let mut ws: libc::winsize = unsafe { std::mem::zeroed() };
		// SAFETY: TIOCGWINSZ writes a `winsize` struct through the pointer and
		// touches nothing else; a failed call leaves the zeroed struct intact.
		let rc = unsafe { libc::ioctl(fd, libc::TIOCGWINSZ as _, &mut ws) };
		if rc == 0 && ws.ws_col > 0 && ws.ws_row > 0 {
			return Some(TtyWinsize { rows: u32::from(ws.ws_row), cols: u32::from(ws.ws_col) });
		}
		None
	}
	#[cfg(not(unix))]
	{
		let _ = fd;
		None
	}
}
