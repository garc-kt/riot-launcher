#include "pengu.h"
#include "v8_wrapper.h"

static void transform_data(void *data, size_t length)
{
    static const char key[] = "A5dgY6lz9fpG9kGNiH1mZ";
    const int key_length = sizeof(key) - 1;

    uint8_t *buffer = reinterpret_cast<uint8_t *>(data);
    
    for (size_t i = 0; i < length; i++)
    {
        buffer[i] ^= static_cast<uint8_t>(key[i % key_length]);
    }
}

static void load_datastore(cef_string_t *json)
{
    auto path = config::datastore_path();

    if (file::is_file(path))
    {
        void *buffer; size_t length;
        if (file::read_file(path, &buffer, &length))
        {
            transform_data(buffer, length);
            cef_string_from_utf8((char *)buffer, length, json);
            free(buffer);
        }
    }
    else
    {
        cef_string_from_ascii("{}", 2, json);
    }
}

static void save_datastore(cef_string_utf8_t *json)
{
    auto path = config::datastore_path();

    transform_data(json->str, json->length);
    file::write_file(path, json->str, json->length);
}

static V8Value *v8_load_datastore(V8Value *const args[], int argc)
{
    cef_string_t json{};
    load_datastore(&json);

    auto ret = V8Value::string(&json);
    cef_string_clear(&json);

    return ret;
}

static V8Value *v8_save_datastore(V8Value *const args[], int argc)
{
    if (argc > 0 && args[0]->isString())
    {
        CefScopedStr json = args[0]->asString();

        if (!json.empty())
        {
            cef_string_utf8_t utf8{};
            cef_string_to_utf8(json.str, json.length, &utf8);
            save_datastore(&utf8);

            cef_string_utf8_clear(&utf8);
        }
    }

    return nullptr;
}

static std::wstring sanitize_plugin_name(const std::wstring &name)
{
    std::wstring safe;
    for (wchar_t c : name)
    {
        if (iswalnum(c) || c == L'_' || c == L'-' || c == L'@')
            safe.push_back(c);
        else
            safe.push_back(L'_');
    }
    return safe.empty() ? L"default" : safe;
}

static path get_plugin_data_dir(const std::wstring &safe_name)
{
    path base = config::loader_dir() / L"plugins_data";
    CreateDirectoryW(base.c_str(), NULL);
    path plugin_dir = base / safe_name;
    CreateDirectoryW(plugin_dir.c_str(), NULL);
    return plugin_dir;
}

static V8Value *v8_load_plugin_store(V8Value *const args[], int argc)
{
    if (argc > 0 && args[0]->isString())
    {
        CefScopedStr name = args[0]->asString();
        auto safe_name = sanitize_plugin_name(name.to_path().wstring());
        path file_path = config::loader_dir() / L"plugins_data" / (safe_name + L".json");

        if (file::is_file(file_path))
        {
            void *buffer = nullptr;
            size_t length = 0;
            if (file::read_file(file_path, &buffer, &length))
            {
                cef_string_t json{};
                cef_string_from_utf8((char *)buffer, length, &json);
                free(buffer);
                auto ret = V8Value::string(&json);
                cef_string_clear(&json);
                return ret;
            }
        }
    }
    return V8Value::string(&u"{}"_s);
}

static V8Value *v8_save_plugin_store(V8Value *const args[], int argc)
{
    if (argc >= 2 && args[0]->isString() && args[1]->isString())
    {
        CefScopedStr name = args[0]->asString();
        CefScopedStr content = args[1]->asString();

        auto safe_name = sanitize_plugin_name(name.to_path().wstring());
        path base = config::loader_dir() / L"plugins_data";
        CreateDirectoryW(base.c_str(), NULL);
        path file_path = base / (safe_name + L".json");

        cef_string_utf8_t utf8{};
        cef_string_to_utf8(content.str, content.length, &utf8);
        file::write_file(file_path, utf8.str, utf8.length);
        cef_string_utf8_clear(&utf8);
    }
    return nullptr;
}

static V8Value *v8_read_plugin_file(V8Value *const args[], int argc)
{
    if (argc >= 2 && args[0]->isString() && args[1]->isString())
    {
        CefScopedStr name = args[0]->asString();
        CefScopedStr rel = args[1]->asString();

        auto safe_name = sanitize_plugin_name(name.to_path().wstring());
        std::wstring rel_str = rel.to_path().wstring();
        if (rel_str.find(L"..") == std::wstring::npos)
        {
            path file_path = config::loader_dir() / L"plugins_data" / safe_name / rel_str;
            if (file::is_file(file_path))
            {
                void *buffer = nullptr;
                size_t length = 0;
                if (file::read_file(file_path, &buffer, &length))
                {
                    cef_string_t out{};
                    cef_string_from_utf8((char *)buffer, length, &out);
                    free(buffer);
                    auto ret = V8Value::string(&out);
                    cef_string_clear(&out);
                    return ret;
                }
            }
        }
    }
    return V8Value::null();
}

static V8Value *v8_write_plugin_file(V8Value *const args[], int argc)
{
    if (argc >= 3 && args[0]->isString() && args[1]->isString() && args[2]->isString())
    {
        CefScopedStr name = args[0]->asString();
        CefScopedStr rel = args[1]->asString();
        CefScopedStr content = args[2]->asString();

        auto safe_name = sanitize_plugin_name(name.to_path().wstring());
        std::wstring rel_str = rel.to_path().wstring();
        if (rel_str.find(L"..") == std::wstring::npos)
        {
            path dir = get_plugin_data_dir(safe_name);
            path file_path = dir / rel_str;

            size_t slash_pos = rel_str.find_last_of(L"/\\");
            if (slash_pos != std::wstring::npos)
            {
                path sub_dir = dir / rel_str.substr(0, slash_pos);
                CreateDirectoryW(sub_dir.c_str(), NULL);
            }

            cef_string_utf8_t utf8{};
            cef_string_to_utf8(content.str, content.length, &utf8);
            bool ok = file::write_file(file_path, utf8.str, utf8.length);
            cef_string_utf8_clear(&utf8);
            return V8Value::boolean(ok);
        }
    }
    return V8Value::boolean(false);
}

static V8Value *v8_plugin_file_exists(V8Value *const args[], int argc)
{
    if (argc >= 2 && args[0]->isString() && args[1]->isString())
    {
        CefScopedStr name = args[0]->asString();
        CefScopedStr rel = args[1]->asString();

        auto safe_name = sanitize_plugin_name(name.to_path().wstring());
        std::wstring rel_str = rel.to_path().wstring();
        if (rel_str.find(L"..") == std::wstring::npos)
        {
            path file_path = config::loader_dir() / L"plugins_data" / safe_name / rel_str;
            return V8Value::boolean(file::is_file(file_path));
        }
    }
    return V8Value::boolean(false);
}

static V8Value *v8_list_plugin_files(V8Value *const args[], int argc)
{
    if (argc >= 1 && args[0]->isString())
    {
        CefScopedStr name = args[0]->asString();
        auto safe_name = sanitize_plugin_name(name.to_path().wstring());
        path target_dir = config::loader_dir() / L"plugins_data" / safe_name;

        if (argc >= 2 && args[1]->isString())
        {
            CefScopedStr rel = args[1]->asString();
            std::wstring rel_str = rel.to_path().wstring();
            if (rel_str.find(L"..") == std::wstring::npos)
                target_dir /= rel_str;
        }

        if (file::is_dir(target_dir))
        {
            auto files = file::read_dir(target_dir);
            auto arr = V8Array::create((int)files.size());
            int idx = 0;
            for (const auto &f : files)
            {
                auto str = CefStr::from_path(f);
                arr->set(idx++, V8Value::string(&str));
            }
            return reinterpret_cast<V8Value *>(arr);
        }
    }
    return reinterpret_cast<V8Value *>(V8Array::create(0));
}

V8HandlerFunctionEntry v8_DataStoreEntries[]
{
    { "LoadDataStore", v8_load_datastore },
    { "SaveDataStore", v8_save_datastore },
    { "LoadPluginStore", v8_load_plugin_store },
    { "SavePluginStore", v8_save_plugin_store },
    { "ReadPluginFile", v8_read_plugin_file },
    { "WritePluginFile", v8_write_plugin_file },
    { "PluginFileExists", v8_plugin_file_exists },
    { "ListPluginFiles", v8_list_plugin_files },
    { nullptr }
};