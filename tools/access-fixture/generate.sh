#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
output="${1:-$repo_root/app/test/fixtures/sample-access.mdb}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
base='https://repo.maven.apache.org/maven2'

fetch_verified() {
  local path="$1" filename="$2"
  python3 - "$base/$path/$filename" "$base/$path/$filename.sha1" "$work_dir/$filename" <<'PY'
import hashlib
import sys
from urllib.request import urlopen

artifact_url, checksum_url, destination = sys.argv[1:]
with urlopen(artifact_url, timeout=30) as response:
    data = response.read()
with urlopen(checksum_url, timeout=30) as response:
    published = response.read().decode("ascii").strip().split()[0].lower()
actual = hashlib.sha1(data).hexdigest()
if actual != published:
    raise SystemExit(f"SHA-1 mismatch for {artifact_url}: {actual} != {published}")
with open(destination, "wb") as output_file:
    output_file.write(data)
print(f"Verified {artifact_url.rsplit('/', 1)[-1]}: {actual}")
PY
}

fetch_verified 'com/healthmarketscience/jackcess/jackcess/4.0.7' 'jackcess-4.0.7.jar'
fetch_verified 'org/apache/commons/commons-lang3/3.10' 'commons-lang3-3.10.jar'
fetch_verified 'commons-logging/commons-logging/1.2' 'commons-logging-1.2.jar'

classpath="$work_dir/jackcess-4.0.7.jar:$work_dir/commons-lang3-3.10.jar:$work_dir/commons-logging-1.2.jar"
mkdir "$work_dir/classes"
javac --release 21 -cp "$classpath" -d "$work_dir/classes" "$repo_root/tools/access-fixture/GenerateAccessFixture.java"
mkdir -p "$(dirname "$output")"
java -cp "$work_dir/classes:$classpath" GenerateAccessFixture "$output"
