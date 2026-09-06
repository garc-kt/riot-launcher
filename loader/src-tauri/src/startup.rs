use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

/// Run-on-boot via the per-user Run key. HKCU (not HKLM) so it needs no
/// elevation — consistent with the rest of the app never requiring admin
/// except to (un)install the injection hook itself.
#[cfg(windows)]
mod win {
    use std::io::Error;
    use winreg::{enums::*, RegKey};

    const RUN_KEY_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const VALUE_NAME: &str = "Riot Loader";

    fn expected_command() -> String {
        let exe = std::env::current_exe().unwrap();
        format!("\"{}\"", exe.display())
    }

    pub fn is_enabled() -> bool {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey_with_flags(RUN_KEY_PATH, KEY_READ) {
            if let Ok(value) = key.get_value(VALUE_NAME) as Result<String, Error> {
                // Compare, don't just check presence: a stale entry from an
                // old install path shouldn't read back as "enabled" here.
                return value == expected_command();
            }
        }
        false
    }

    pub fn set_enable(enable: bool) -> bool {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = match hkcu.open_subkey_with_flags(RUN_KEY_PATH, KEY_SET_VALUE) {
            Ok(k) => k,
            Err(_) => return false,
        };

        if enable {
            key.set_value(VALUE_NAME, &expected_command()).is_ok()
        } else {
            match key.delete_value(VALUE_NAME) {
                Ok(()) => true,
                // Already absent is not a failure.
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => true,
                Err(_) => false,
            }
        }
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    #[tauri::command]
    fn is_enabled() -> bool {
        #[cfg(windows)]
        {
            win::is_enabled()
        }
        #[cfg(not(windows))]
        {
            false
        }
    }

    #[tauri::command]
    fn set_enable(enable: bool) -> bool {
        #[cfg(windows)]
        {
            win::set_enable(enable)
        }
        #[cfg(not(windows))]
        {
            let _ = enable;
            false
        }
    }

    Builder::new("startup")
        .invoke_handler(tauri::generate_handler![is_enabled, set_enable])
        .build()
}
