#!/bin/bash
# Songloft Plugin Build Script
# 生成带有正确哈希值的插件包

set -e

PLUGIN_DIR="$1"
PLUGIN_NAME=$(basename "$PLUGIN_DIR")

if [ -z "$PLUGIN_DIR" ] || [ ! -d "$PLUGIN_DIR" ]; then
    echo "Usage: $0 <plugin-directory>"
    exit 1
fi

cd "$PLUGIN_DIR"

# 检查必要文件
if [ ! -f "plugin.json" ]; then
    echo "Error: plugin.json not found in $PLUGIN_DIR"
    exit 1
fi

if [ ! -f "dist/main.js" ]; then
    echo "Error: dist/main.js not found. Run 'npm run build' first."
    exit 1
fi

# 读取 plugin.json
PLUGIN_JSON=$(cat plugin.json)
ENTRY_PATH=$(echo "$PLUGIN_JSON" | grep -o '"entryPath"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"entryPath"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$ENTRY_PATH" ]; then
    # 如果没有 entryPath，使用插件名
    ENTRY_PATH="$PLUGIN_NAME"
fi

echo "Building $PLUGIN_NAME..."
echo "  entryPath: $ENTRY_PATH"

# 计算 main.js 的哈希 (MD5)
if command -v md5sum &> /dev/null; then
    ENTRY_HASH=$(md5sum dist/main.js | cut -d' ' -f1)
else
    ENTRY_HASH=$(md5 -q dist/main.js)
fi

echo "  entryHash: $ENTRY_HASH"

# 创建临时目录
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# 复制文件到临时目录
cp -r dist/* "$TMP_DIR/"
cp plugin.json "$TMP_DIR/"

# 如果有 static 目录，复制它
if [ -d "static" ]; then
    cp -r static "$TMP_DIR/"
fi

# 创建 ZIP 包
cd "$TMP_DIR"
ZIP_NAME="${PLUGIN_NAME}.jsplugin.zip"
zip -r "$ZIP_NAME" . > /dev/null

# 计算 ZIP 的哈希
if command -v md5sum &> /dev/null; then
    ZIP_HASH=$(md5sum "$ZIP_NAME" | cut -d' ' -f1)
else
    ZIP_HASH=$(md5 -q "$ZIP_NAME")
fi

echo "  zipHash: $ZIP_HASH"

# 更新 plugin.json 中的哈希值
cd - > /dev/null
cat > "$PLUGIN_DIR/dist/plugin.json" << EOF
{
  "name": "$(echo "$PLUGIN_JSON" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')",
  "version": "$(echo "$PLUGIN_JSON" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')",
  "entryPath": "$ENTRY_PATH",
  "main": "main.js",
  "minHostVersion": "1.0.0",
  "permissions": $(echo "$PLUGIN_JSON" | grep -o '"permissions"[[:space:]]*:[[:space:]]*\[[^]]*\]' | sed 's/.*"permissions"[[:space:]]*:[[:space:]]*//' || echo '[]'),
  "entryHash": "$ENTRY_HASH",
  "zipHash": "$ZIP_HASH",
  "description": "$(echo "$PLUGIN_JSON" | grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"description"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo '')",
  "author": "$(echo "$PLUGIN_JSON" | grep -o '"author"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"author"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo '')"
}
EOF

# 重新创建带正确 plugin.json 的 ZIP
rm -f "$TMP_DIR/$ZIP_NAME"
cp "$PLUGIN_DIR/dist/plugin.json" "$TMP_DIR/plugin.json"
cd "$TMP_DIR"
zip -r "$ZIP_NAME" . > /dev/null

# 复制最终 ZIP 到插件目录
cp "$ZIP_NAME" "$PLUGIN_DIR/dist/"

echo ""
echo "✓ Built successfully: $PLUGIN_DIR/dist/$ZIP_NAME"
echo ""
echo "Package contents:"
unzip -l "$PLUGIN_DIR/dist/$ZIP_NAME" | tail -5