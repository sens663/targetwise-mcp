"""Build a reproducible, credential-free MCPB and Claude Code configuration."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / "connectors/claude"
out = root / "public/downloads"
out.mkdir(parents=True, exist_ok=True)
(source / "icon.png").write_bytes((root / "public/targetwise-connector-logo.png").read_bytes())
manifest = json.loads((source / "manifest.json").read_text())
assert manifest["user_config"]["api_key"]["sensitive"] is True
assert manifest["server"]["entry_point"] == "server/index.mjs"
bundle = out / "targetwise-claude.mcpb"
with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ["manifest.json", "README.md", "icon.png", "LICENSE", "server/index.mjs", "server/bridge.mjs"]:
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 7, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, (source / name).read_bytes())
digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
(out / "targetwise-claude.mcpb.sha256").write_text(f"{digest}  {bundle.name}\n")
(out / "targetwise-claude-code.json").write_text(json.dumps({"mcpServers": {"targetwise": {
    "type": "http", "url": "https://targetwise.ai/api/mcp",
    "headers": {"Authorization": "Bearer ${TARGETWISE_API_KEY}"}
}}}, indent=2) + "\n")
print(f"Packaged TargetWise {manifest['version']}: {bundle.stat().st_size} bytes, SHA-256 {digest}")
