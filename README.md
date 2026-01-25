# instl

A CLI tool for installing files with LTSV recipe support

## Quick Start

```sh
# Copy file
instl ./config.json /etc/app/
```

```sh
# Execute recipe
instl sync recipe.ltsv
```

## Installation

### Native Binary

Download from [GitHub Releases](https://github.com/sasaplus1/instl/releases):

| Platform | Architecture           | File                           |
|----------|------------------------|--------------------------------|
| Linux    | x64                    | `instl-linux-x64.tar.gz`       |
| Linux    | arm64                  | `instl-linux-arm64.tar.gz`     |
| macOS    | x64 (Intel)            | `instl-darwin-x64.tar.gz`      |
| macOS    | arm64 (Apple Silicon)  | `instl-darwin-arm64.tar.gz`    |

```sh
# Example: macOS Apple Silicon
curl -fsSL https://github.com/sasaplus1/instl/releases/latest/download/instl-darwin-arm64.tar.gz | tar xz
./instl --version
```

### npm

```sh
npm install -g @sasaplus1/instl
```

- Requires: Node.js 24 or later

## Commands

### Default (install-compatible mode)

```sh
instl [options] <sources...> <dest>
```

- **Copy mode**: Default behavior
- **Directory mode** (`-d`): Arguments are directories to create (not DEST)
- **Symlink mode** (`-l`): Only SOURCE/DEST two arguments

**Argument rules**:

- When multiple sources, DEST must be an existing directory
- When single source, if DEST is a directory, basename is appended

### sync command

```sh
instl sync [options] <recipe>
```

## Options

### Common options

| Option          | Description                               |
|-----------------|-------------------------------------------|
| `-v, --verbose` | Enable verbose output                     |
| `--dry-run`     | Show what would be done without executing |

### Install mode only

| Option              | Description                                           |
|---------------------|-------------------------------------------------------|
| `-m, --mode <mode>` | Set permission mode (octal: 644, 0755)                |
| `-o, --owner <uid>` | Set owner UID (numeric only)                          |
| `-g, --group <gid>` | Set group GID (numeric only)                          |
| `-d, --directory`   | Create directories mode                               |
| `-b, --backup`      | Create backup of existing files with `.old` extension |
| `-l, --symlink`     | Create symbolic link mode                             |

**Mutually exclusive**:

- `-d` cannot be used with `-b` or `-l`
- `-b` cannot be used with `-l`

## Recipe Format (LTSV-like)

### Fields

| Field   | Required   | Description                             |
|---------|------------|-----------------------------------------|
| `op`    | ✓          | Operation: `touch`, `mkdir`, `cp`, `ln` |
| `dest`  | ✓          | Destination path                        |
| `src`   | For cp/ln  | Source path                             |
| `mode`  |            | Permission mode                         |
| `owner` |            | Owner UID (numeric)                     |
| `group` |            | Group GID (numeric)                     |

### Operations

| op      | Description          | src required   | Default mode   |
|---------|----------------------|----------------|----------------|
| `touch` | Create/update file   | No             | 0644           |
| `mkdir` | Create directory     | No             | 0755           |
| `cp`    | Copy file            | Yes            | 0644           |
| `ln`    | Create symbolic link | Yes            | -              |

### Recipe example

```
# Create directory
op:mkdir	dest:/opt/app	mode:0755

# Copy file
op:cp	src:./config.json	dest:/opt/app/config.json	mode:0644

# Symbolic link (relative path is preserved)
op:ln	src:../app/bin	dest:/usr/local/bin/app

# Environment variable expansion
op:touch	dest:$HOME/.app/state	mode:0600
```

## Examples

```sh
# Copy single file
instl ./app.conf /etc/app/
```

```sh
# Copy multiple files to existing directory
instl ./bin/tool ./bin/helper /usr/local/bin/
```

```sh
# Create directories
instl -d -m 755 /var/app/logs /var/app/tmp
```

```sh
# Create symbolic link (replaces existing file)
instl -l ./release/app /usr/local/bin/app
```

```sh
# Overwrite with backup
instl -b ./nginx.conf /etc/nginx/nginx.conf
```

```sh
# Dry run check
instl --dry-run -v ./src/app.js /opt/app/
```

```sh
# Execute recipe
instl sync recipe.ltsv
instl sync --dry-run -v recipe.ltsv
```

## Notes

- **Path resolution**: Relative paths in recipe are resolved from recipe file's directory
- **Environment variables**: Expanded with `$NAME` format (undefined becomes empty string)
- **Comments**: Lines starting with `#` and empty lines are ignored
- **sync cp behavior**: DEST as directory causes error (differs from CLI copy behavior)
- **Non-transactional**: sync executes sequentially, no rollback on partial failure
- **Backup**: Created with `.old` extension, existing `.old` is overwritten

## License

The MIT license
