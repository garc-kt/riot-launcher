use std::{io::Error, path::PathBuf};
use winreg::{
    enums::{HKEY_LOCAL_MACHINE, KEY_READ},
    RegKey,
};

/// Check if Developer Mode is active.
pub fn is_developer() -> bool {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    const REG_PATH: &str = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock";

    if let Ok(key) = hklm.open_subkey_with_flags(REG_PATH, KEY_READ) {
        if let Ok(value) = key.get_value("AllowDevelopmentWithoutDevLicense") as Result<u32, Error>
        {
            return value == 1;
        }
    }

    false
}

/// Check if the running process is admin.
pub fn is_admin() -> bool {
    is_elevated::is_elevated()
}

/// Fix borderless window shadow.
/// Don't use windows_sys because dependencies hell.
pub fn enable_shadow(hwnd: isize) {
    use libc::c_void;

    #[repr(C)]
    struct MARGINS {
        left: i32,
        right: i32,
        top: i32,
        bottom: i32,
    }

    #[link(name = "dwmapi")]
    extern "C" {
        fn DwmExtendFrameIntoClientArea(hwnd: isize, pMarInset: *const MARGINS) -> i32;
        fn DwmSetWindowAttribute(
            hwnd: isize,
            dwAttribute: i32,
            pvAttribute: *const c_void,
            cbAttribute: u32,
        );
    }

    unsafe {
        DwmSetWindowAttribute(hwnd, 2, &2 as *const _ as _, 4);
        let margins = MARGINS {
            left: 0,
            right: 0,
            top: 1,
            bottom: 0,
        };
        DwmExtendFrameIntoClientArea(hwnd, &margins);
    }
}

/// Check if webview2 is installed or not.
pub fn is_webview2_installed() -> bool {
    let guids = [
        "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "{F3017226-992A-44A6-992E-DEE82A707704}",
    ];
    let prefixes = [
        r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients",
        r"SOFTWARE\Microsoft\EdgeUpdate\Clients",
    ];

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    for prefix in &prefixes {
        for guid in &guids {
            let reg_key = format!("{}\\{}", prefix, guid);
            if let Ok(key) = hklm.open_subkey_with_flags(&reg_key, KEY_READ) {
                if let Ok(location) = key.get_value("location") as Result<String, Error> {
                    if let Ok(pv) = key.get_value("pv") as Result<String, Error> {
                        let base_dir = std::path::Path::new(&location).join(&pv);
                        if base_dir.join("msedgewebview2.exe").exists()
                            || base_dir.join("msedge.exe").exists()
                            || base_dir.exists()
                        {
                            return true;
                        }
                    }
                }
            }
        }
    }

    // Direct fallback check for default evergreen installation path
    let default_paths = [
        r"C:\Program Files (x86)\Microsoft\EdgeWebView\Application",
        r"C:\Program Files\Microsoft\EdgeWebView\Application",
    ];
    for default_dir in &default_paths {
        let p = std::path::Path::new(default_dir);
        if p.exists() {
            if let Ok(entries) = std::fs::read_dir(p) {
                for entry in entries.flatten() {
                    let sub = entry.path();
                    if sub.is_dir()
                        && (sub.join("msedgewebview2.exe").exists()
                            || sub.join("msedge.exe").exists())
                    {
                        return true;
                    }
                }
            }
        }
    }

    false
}

/// Detect existing upstream PenguLoader installation to prevent conflict (§9.1)
///
/// SOURCE OF TRUTH — this is what ships. `packages/contracts/src/conflict.ts`
/// is a test-only mirror of these exact conditions for `tests/coexistence.test.mjs`.
/// Any change here (directory list, IFEO substring checks, proxy-DLL
/// comparison) MUST be mirrored there in the same commit.
pub fn detect_upstream_conflict() -> Option<String> {
    let check_dirs = [
        std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string()),
        std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string()),
        std::env::var("LOCALAPPDATA").unwrap_or_default(),
    ];
    for base in check_dirs {
        if base.is_empty() { continue; }
        let pengu_dir = std::path::Path::new(&base).join("Pengu Loader");
        if pengu_dir.exists() {
            return Some(format!(
                "Detected existing upstream PenguLoader installation at \"{}\". Both proxy system DLLs and cannot coexist. Please remove upstream PenguLoader before installing Riot Loader.",
                pengu_dir.display()
            ));
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let ifeo_path = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe";
    if let Ok(key) = hklm.open_subkey_with_flags(ifeo_path, KEY_READ) {
        if let Ok(val) = key.get_value("Debugger") as Result<String, Error> {
            let lower = val.to_lowercase();
            let our_core = crate::config::core_path().display().to_string().to_lowercase();
            let is_riot = lower.contains("riot-loader") || lower.contains("riot loader") || lower.contains("riot_loader");
            if lower.contains("pengu") || (lower.starts_with("rundll32") && !lower.contains(&our_core) && !is_riot) {
                return Some(format!(
                    "Detected conflicting IFEO debugger entry: \"{}\". Please uninstall existing loader before activating Riot Loader.",
                    val
                ));
            }
        }
    }

    if let Some(league_dir) = crate::config::league_dir() {
        let our_core = crate::config::core_path();
        for proxy_name in ["version.dll", "d3d9.dll", "dwrite.dll"] {
            let proxy_path = league_dir.join(proxy_name);
            if proxy_path.exists() {
                if let Ok(target) = std::fs::read_link(&proxy_path) {
                    let target_str = target.display().to_string().to_lowercase();
                    let is_riot = target_str.contains("riot-loader") || target_str.contains("riot loader") || target_str.contains("riot_loader");
                    if target != our_core && !is_riot {
                        return Some(format!(
                            "Detected conflicting proxy DLL at \"{}\" pointing to \"{}\". Please remove it before proceeding.",
                            proxy_path.display(),
                            target.display()
                        ));
                    }
                } else if let Ok(canon) = proxy_path.canonicalize() {
                    if let Ok(our_canon) = our_core.canonicalize() {
                        let canon_str = canon.display().to_string().to_lowercase();
                        let is_riot = canon_str.contains("riot-loader") || canon_str.contains("riot loader") || canon_str.contains("riot_loader");
                        if canon != our_canon && !is_riot {
                            return Some(format!(
                                "Detected conflicting proxy DLL at \"{}\". Please remove it before proceeding.",
                                proxy_path.display()
                            ));
                        }
                    }
                }
            }
        }
    }

    None
}
