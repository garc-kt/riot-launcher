#include "pengu.h"
#include "hook.h"
#include "include/cef_version.h"

// CefContext::GetBackgroundColor()
static cef_color_t get_background_color(void *rcx, cef_browser_settings_t *, cef_state_t)
{
    return 0; // SK_ColorTRANSPARENT
}

static void fix_browser_background(const void *rladdr)
{
    // KNOWN BROKEN as of the Vanguard-flavored 16.17 client (libcef.dll
    // 108.4.13.0): CEF_VERSION_MAJOR alone (checked by the caller) doesn't
    // guarantee this exact byte layout still holds, and find_memory() scans
    // from the start of the *entire* module with no anchor near `rladdr`,
    // so a stale/ambiguous pattern can silently patch the wrong function
    // instead of the real CefContext::GetBackgroundColor(). That's exactly
    // what was happening: every LeagueClientUxRender.exe crashed with the
    // same deterministic 0xC0000005 at the same offset in libcef.dll,
    // every launch. This is cosmetic-only (transparent CEF background), so
    // disable it rather than risk corrupting an unrelated function until
    // the pattern is re-derived against the current libcef.dll build.
#if 0
    const char *pattern = "41 83 F8 01 74 0B 41 83 F8 02 75 0A 45 31 C0";
    using Fn = decltype(&get_background_color);
    static hook::Hook<Fn> GetBackgroundColor;
    // Find CefContext::GetBackgroundColor()
    auto func = reinterpret_cast<Fn>(dylib::find_memory(rladdr, pattern));

    if (func != nullptr)
        GetBackgroundColor.hook(func, get_background_color);
#else
    (void)rladdr;
#endif
}

bool check_libcef_version(bool is_browser)
{
    void *libcef = dylib::find_lib(LIBCEF_MODULE_NAME);

    if (libcef != nullptr)
    {
        auto get_version = reinterpret_cast<decltype(&cef_version_info)>(dylib::find_proc(libcef, "cef_version_info"));

        // Check CEF version
        if (get_version == nullptr || get_version(0) != CEF_VERSION_MAJOR)
        {
            if (is_browser)
                dialog::alert("Riot Loader does not support your Client version.", "Riot Loader");
            return false;
        }

        if (is_browser)
            fix_browser_background((const void *)get_version);

        return true;
    }
    else
    {
        if (is_browser)
            dialog::alert("Failed to load Chromium Embedded Framework.", "Pengu Loader");
        return false;
    }
}