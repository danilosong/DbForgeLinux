#!/usr/bin/env bash
# VM Windows simples (QEMU/KVM) para observar o dbForge original — uso somente para estudo comportamental,
# com licença/trial legítimos do usuário. Nada aqui contorna licenciamento ou ativação.
set -euo pipefail

VM_DIR="${VM_DIR:-$HOME/vm/tuxsql-ref}"
DISK="$VM_DIR/disk.qcow2"
VARS="$VM_DIR/OVMF_VARS.fd"
SHARE="$VM_DIR/share"            # pasta do host exposta ao Windows como um disco (somente leitura)
QMP="$VM_DIR/qmp.sock"
PIDFILE="$VM_DIR/qemu.pid"
RAM="${VM_RAM:-6G}"
CPUS="${VM_CPUS:-4}"
DISK_SIZE="${VM_DISK_SIZE:-60G}"
DISPLAY_MODE="${VM_DISPLAY:-gtk}"  # gtk (janela) | none (sem janela; use "shot")
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export VM_QMP="$QMP"
VIRTIO_URL="https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso"

die() { echo "erro: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || die "comando '$1' não encontrado (instale: $2)"; }

preflight() {
  need qemu-system-x86_64 "sudo apt install qemu-system-x86 qemu-utils"
  need qemu-img "sudo apt install qemu-utils"
  [ -w /dev/kvm ] || die "/dev/kvm sem acesso de escrita (adicione seu usuário ao grupo kvm: sudo usermod -aG kvm \$USER, e relogue)"
}

running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

qemu_base() {
  local args=(
    -name tuxsql-ref -machine q35,accel=kvm -cpu host -smp "$CPUS" -m "$RAM"
    -drive "file=$DISK,if=none,id=sys,format=qcow2,cache=writeback,discard=unmap" -device ich9-ahci,id=ahci -device ide-hd,drive=sys,bus=ahci.0
    -device qemu-xhci -device usb-tablet -device usb-kbd
    -vga std
    -netdev "user,id=n0,hostfwd=tcp:127.0.0.1:${VM_RDP_PORT:-33389}-:3389${VM_NO_NET:+,restrict=on}" -device e1000e,netdev=n0
    -rtc base=localtime
    -qmp "unix:$QMP,server,nowait"
    -pidfile "$PIDFILE"
    -display "$DISPLAY_MODE"
  )
  if [ "${VM_UEFI:-0}" = "1" ]; then
    [ -f "$VARS" ] || cp /usr/share/OVMF/OVMF_VARS_4M.fd "$VARS"
    args+=(-drive "if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd" -drive "if=pflash,format=raw,file=$VARS")
  fi
  if [ -d "$SHARE" ] && [ -n "$(ls -A "$SHARE" 2>/dev/null)" ]; then
    args+=(-drive "file=fat:ro:$SHARE,format=raw,if=none,id=share,readonly=on" -device usb-storage,drive=share,removable=on)
  fi
  printf '%s\0' "${args[@]}"
}

launch() {  # launch [args extras...]
  running && die "a VM já está rodando (pid $(cat "$PIDFILE")). Use: $0 stop"
  rm -f "$QMP"
  local base=(); while IFS= read -r -d '' a; do base+=("$a"); done < <(qemu_base)
  qemu-system-x86_64 "${base[@]}" "$@" &
  for _ in $(seq 1 50); do [ -S "$QMP" ] && break; sleep 0.2; done
  [ -S "$QMP" ] || die "QEMU não subiu (veja mensagens acima)"
  echo "VM iniciada (pid $(cat "$PIDFILE" 2>/dev/null || echo ?)). Tela: janela do QEMU | RDP: 127.0.0.1:${VM_RDP_PORT:-33389}"
}

cmd_setup() {
  preflight
  mkdir -p "$VM_DIR" "$SHARE"
  [ -f "$DISK" ] && echo "disco já existe: $DISK" || { qemu-img create -f qcow2 "$DISK" "$DISK_SIZE" >/dev/null; echo "disco criado: $DISK ($DISK_SIZE, esparso)"; }
  echo "pasta de transferência (host→Windows, aparece como um disco): $SHARE"
  echo
  echo "Próximo passo: baixe uma ISO do Windows 10/11 e rode:  $0 install /caminho/Windows.iso"
  echo "  • Windows 10 Enterprise Evaluation (90 dias, oficial): https://www.microsoft.com/evalcenter/evaluate-windows-10-enterprise"
  echo "  • Windows 11 exige UEFI+TPM; com este script use VM_UEFI=1 e a ISO do Win10 é bem mais simples."
}

cmd_install() {
  preflight; local iso="${1:-}"
  [ -f "$iso" ] || die "informe a ISO do Windows: $0 install /caminho/Windows.iso"
  [ -f "$DISK" ] || cmd_setup
  echo "Instalação: dispositivos SATA/e1000e/VGA padrão (o Windows instala sem drivers extras)."
  launch -drive "file=$iso,media=cdrom,if=none,id=cd,readonly=on" -device ide-cd,drive=cd,bus=ahci.2 -boot order=dc,menu=on
  echo "Siga o instalador na janela do QEMU. Escolha 'Não tenho chave do produto' se usar o trial/evaluation."
  echo "Dica: ao terminar, rode '$0 stop' e depois '$0 snap base' para guardar um estado limpo."
}

cmd_run() { preflight; [ -f "$DISK" ] || die "rode '$0 setup' e '$0 install' primeiro"; launch -boot order=c; }
cmd_stop() {
  if running; then python3 "$HERE/qmp.py" powerdown || true; echo "desligamento solicitado (aguarde o Windows desligar; '$0 kill' força)."; else echo "VM não está rodando."; fi
}
cmd_kill() { running && { kill "$(cat "$PIDFILE")"; echo "VM encerrada à força."; } || echo "VM não está rodando."; }
cmd_status() { if running; then echo "rodando (pid $(cat "$PIDFILE")), estado: $(python3 "$HERE/qmp.py" status)"; else echo "parada"; fi; }
cmd_snap() { running && die "pare a VM antes de criar snapshot ($0 stop)"; qemu-img snapshot -c "${1:?nome}" "$DISK"; echo "snapshot '$1' criado"; }
cmd_restore() { running && die "pare a VM antes ($0 stop)"; qemu-img snapshot -a "${1:?nome}" "$DISK"; echo "snapshot '$1' restaurado"; }
cmd_snaps() { qemu-img snapshot -l "$DISK"; }
cmd_put() {  # put <arquivo...>: copia para a pasta de transferência (vale no próximo boot)
  mkdir -p "$SHARE"; cp -v "$@" "$SHARE/"; echo "Reinicie a VM ($0 stop; $0 run) para o disco 'share' aparecer."
}
cmd_virtio() { mkdir -p "$SHARE"; echo "baixando virtio-win.iso (opcional: drivers para rede/disco mais rápidos)…"; curl -fL -o "$SHARE/virtio-win.iso" "$VIRTIO_URL" && echo "salvo em $SHARE/virtio-win.iso"; }

usage() { cat <<USAGE
VM Windows simples para estudar o dbForge original (QEMU/KVM)
  $0 setup                    cria pasta, disco (${DISK_SIZE}) e mostra onde baixar a ISO
  $0 install <Windows.iso>    inicia a instalação (janela do QEMU)
  $0 run                      inicia a VM instalada
  $0 stop | kill | status     desliga (ACPI) | força | mostra estado
  $0 snap <nome> | restore <nome> | snaps    snapshots (com a VM parada)
  $0 put <arquivos...>        copia arquivos para o disco 'share' visto pelo Windows
  $0 shot [arq.png]           screenshot da tela do Windows (para o Claude analisar)
  $0 type "texto" | key ctrl alt delete | click X Y [right|double]   controle por teclado/mouse
Rede: o Windows enxerga o host em 10.0.2.2 (ex.: MySQL de teste em 10.0.2.2:33067). RDP do host: 127.0.0.1:33389.
VM_NO_NET=1 inicia sem internet (útil no OOBE do Windows para criar conta local offline).
Variáveis: VM_DIR VM_RAM(6G) VM_CPUS(4) VM_DISK_SIZE(60G) VM_UEFI=1 VM_DISPLAY=gtk|none VM_W/VM_H (resolução do convidado p/ cliques)
USAGE
}

case "${1:-}" in
  setup) cmd_setup;; install) shift; cmd_install "$@";; run) cmd_run;; stop) cmd_stop;; kill) cmd_kill;; status) cmd_status;;
  snap) shift; cmd_snap "$@";; restore) shift; cmd_restore "$@";; snaps) cmd_snaps;; put) shift; cmd_put "$@";; virtio) cmd_virtio;;
  shot|type|key|click|drag) python3 "$HERE/qmp.py" "$@";;
  *) usage;;
esac
