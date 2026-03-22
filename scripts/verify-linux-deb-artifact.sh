#!/usr/bin/env bash

set -euo pipefail

TEMP_DIR=""

usage() {
  echo "Usage: $0 <amd64|arm64>" >&2
  exit 1
}

checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@"
  else
    shasum -a 256 "$@"
  fi
}

require_cmd() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[deb-verify] missing required command: ${cmd}" >&2
    exit 1
  }
}

assert_exists() {
  local file="$1"
  if [[ ! -e "${file}" ]]; then
    echo "[deb-verify] expected file does not exist: ${file}" >&2
    exit 1
  fi
}

assert_executable() {
  local file="$1"
  if [[ ! -x "${file}" ]]; then
    echo "[deb-verify] expected executable file is missing or not executable: ${file}" >&2
    exit 1
  fi
}

log_file_info() {
  local file="$1"
  echo "[deb-verify] file: ${file}"
  ls -lh "${file}"
  file "${file}"
  checksum "${file}"
}

assert_file_arch() {
  local file="$1"
  local expected="$2"
  local info

  info="$(file "${file}")"
  echo "[deb-verify] arch-check: ${info}"
  if [[ "${info}" != *"${expected}"* ]]; then
    echo "[deb-verify] unexpected architecture for ${file}" >&2
    echo "[deb-verify] expected substring: ${expected}" >&2
    exit 1
  fi
}

assert_loadable_native_module() {
  local electron_bin="$1"
  local native_module="$2"

  echo "[deb-verify] loading native module with packaged Electron runtime: ${native_module}"
  ELECTRON_RUN_AS_NODE=1 "${electron_bin}" -e '
    const path = require("node:path");
    require(path.resolve(process.argv[1]));
    console.log("[deb-verify] native module loaded successfully");
  ' "${native_module}"
}

main() {
  if [[ $# -ne 1 ]]; then
    usage
  fi

  local deb_arch="$1"
  local prebuild_arch
  local expected_machine
  local deb_file
  local control_arch
  local electron_bin
  local main_binary
  local build_release_pty
  local prebuild_pty

  require_cmd dpkg-deb
  require_cmd file

  case "${deb_arch}" in
    amd64)
      prebuild_arch="x64"
      expected_machine="x86-64"
      ;;
    arm64)
      prebuild_arch="arm64"
      expected_machine="ARM aarch64"
      ;;
    *)
      usage
      ;;
  esac

  deb_file="$(find release -maxdepth 1 -type f -name "*-linux-${deb_arch}.deb" -print | sort | head -n 1)"
  if [[ -z "${deb_file}" ]]; then
    echo "[deb-verify] no deb artifact found for ${deb_arch} under release/" >&2
    exit 1
  fi

  echo "[deb-verify] verifying deb artifact: ${deb_file}"
  log_file_info "${deb_file}"

  control_arch="$(dpkg-deb -f "${deb_file}" Architecture)"
  echo "[deb-verify] control architecture: ${control_arch}"
  if [[ "${control_arch}" != "${deb_arch}" ]]; then
    echo "[deb-verify] deb control architecture mismatch: expected ${deb_arch}, got ${control_arch}" >&2
    exit 1
  fi

  TEMP_DIR="$(mktemp -d)"
  trap 'rm -rf "${TEMP_DIR:-}"' EXIT
  dpkg-deb -x "${deb_file}" "${TEMP_DIR}"

  electron_bin="${TEMP_DIR}/opt/Netcatty/netcatty"
  main_binary="${TEMP_DIR}/opt/Netcatty/netcatty"
  build_release_pty="${TEMP_DIR}/opt/Netcatty/resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node"
  prebuild_pty="${TEMP_DIR}/opt/Netcatty/resources/app.asar.unpacked/node_modules/node-pty/prebuilds/linux-${prebuild_arch}/pty.node"

  assert_executable "${electron_bin}"
  assert_exists "${build_release_pty}"
  assert_exists "${prebuild_pty}"

  echo "[deb-verify] verifying packaged binary architectures"
  log_file_info "${main_binary}"
  log_file_info "${build_release_pty}"
  log_file_info "${prebuild_pty}"

  assert_file_arch "${main_binary}" "${expected_machine}"
  assert_file_arch "${build_release_pty}" "${expected_machine}"
  assert_file_arch "${prebuild_pty}" "${expected_machine}"

  assert_loadable_native_module "${electron_bin}" "${build_release_pty}"
  assert_loadable_native_module "${electron_bin}" "${prebuild_pty}"

  echo "[deb-verify] deb artifact verification passed for ${deb_file}"
}

main "$@"
