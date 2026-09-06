use std::process::Command;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[tauri::command]
fn expand_folder(path: &str) {
    #[cfg(windows)]
    {
        let path = path.replace("/", "\\");
        Command::new("explorer")
            .args(["/expand,", &path])
            .spawn()
            .unwrap();
    }

    #[cfg(target_os = "macos")]
    Command::new("open").arg(path).spawn().unwrap();
}

#[tauri::command]
fn reveal_file(path: &str) {
    #[cfg(windows)]
    {
        let path = path.replace("/", "\\");
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .unwrap();
    }

    #[cfg(target_os = "macos")]
    Command::new("open").args(["-R", path]).spawn().unwrap();
}

/// Is LeagueClientUx.exe currently running? Both the loader (writing
/// `datastore` from the Themes tab) and the injected client (writing it via
/// v8_datastore.cc) do unlocked whole-file rewrites of the same file — if
/// the client is up, a loader-side write can be lost to the client's next
/// save, or vice versa. Callers use this to refuse writes rather than race.
#[tauri::command]
fn is_league_client_running() -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq LeagueClientUx.exe", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout).to_lowercase();
            return text.contains("leagueclientux.exe");
        }
    }
    false
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("shell")
        .invoke_handler(tauri::generate_handler![
            expand_folder,
            reveal_file,
            is_league_client_running
        ])
        .build()
}
