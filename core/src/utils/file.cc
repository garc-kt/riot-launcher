#include "pengu.h"

bool file::is_symlink(const path &path)
{
    DWORD attr = GetFileAttributesW(path.wstring().c_str());
    if (attr == INVALID_FILE_ATTRIBUTES)
        return false;
    return (attr & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
}

bool file::is_dir(const path &path)
{
    DWORD attr = GetFileAttributesW(path.wstring().c_str());
    if (attr == INVALID_FILE_ATTRIBUTES)
        return false;
    return (attr & FILE_ATTRIBUTE_DIRECTORY) != 0;
}

bool file::is_file(const path &path)
{
    DWORD attr = GetFileAttributesW(path.wstring().c_str());
    if (attr == INVALID_FILE_ATTRIBUTES)
        return false;
    return !(attr & FILE_ATTRIBUTE_DIRECTORY);
}

bool file::read_file(const path &path, void **buffer, size_t *length)
{
    FILE* fp = _wfopen(path.c_str(), L"rb");
    if (fp != nullptr)
    {
        fseek(fp, 0, SEEK_END);
        long size = ftell(fp);
        fseek(fp, 0, SEEK_SET);

        *buffer = malloc(size + 1);
        if (length) *length = size;

        fread(*buffer, 1, size, fp);
        reinterpret_cast<uint8_t *>(*buffer)[size] = '\0';

        fclose(fp);
        return true;
    }

    return false;
}

bool file::write_file(const path &path, const void *buffer, size_t length)
{
    FILE *fp = _wfopen(path.c_str(), L"wb");
    if (fp != nullptr)
    {
        fwrite(buffer, 1, length, fp);
        fclose(fp);
        return true;
    }

    return false;
}

std::vector<path> file::read_dir(const path &dir)
{
    std::vector<path> files;
    files.clear();

    std::wstring target = dir.wstring() + L"\\*";
    WIN32_FIND_DATAW fd;
    HANDLE hFind = FindFirstFileW(target.c_str(), &fd);

    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            if (wcscmp(fd.cFileName, L".") != 0 && wcscmp(fd.cFileName, L"..") != 0) {
                files.push_back(fd.cFileName);
            }
        } while (FindNextFileW(hFind, &fd));
        FindClose(hFind);
    }

    return files;
}