#!/usr/bin/env python3
"""Mini cliente QMP para controlar a VM: screenshot, teclado e mouse. Sem dependências externas."""
import json, os, socket, sys, time

SOCK = os.environ.get("VM_QMP", os.path.expanduser("~/vm/dbforge-ref/qmp.sock"))
W, H = int(os.environ.get("VM_W", 1280)), int(os.environ.get("VM_H", 800))  # resolução do convidado (ajuste no Windows para coincidir)

KEYS = {" ": "spc", "\n": "ret", "\t": "tab", "-": "minus", "=": "equal", "[": "bracket_left", "]": "bracket_right",
        ";": "semicolon", "'": "apostrophe", "`": "grave_accent", "\\": "backslash", ",": "comma", ".": "dot", "/": "slash"}
SHIFTED = {"!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
           "_": "-", "+": "=", "{": "[", "}": "]", ":": ";", '"': "'", "~": "`", "|": "\\", "<": ",", ">": ".", "?": "/"}


class Qmp:
    def __init__(self):
        self.s = socket.socket(socket.AF_UNIX)
        self.s.connect(SOCK)
        self.f = self.s.makefile("rw")
        self.f.readline()  # banner
        self.call("qmp_capabilities")

    def call(self, cmd, **args):
        self.f.write(json.dumps({"execute": cmd, "arguments": args}) + "\n")
        self.f.flush()
        while True:
            msg = json.loads(self.f.readline())
            if "return" in msg:
                return msg["return"]
            if "error" in msg:
                raise SystemExit(f"QMP erro: {msg['error'].get('desc')}")

    def key(self, *names, hold_ms=int(os.environ.get("VM_HOLD_MS", 120))):
        self.call("send-key", keys=[{"type": "qcode", "data": n} for n in names], **{"hold-time": hold_ms})

    def type_text(self, text, delay=float(os.environ.get("VM_TYPE_DELAY", 0.12))):
        for ch in text:
            if ch.isupper():
                self.key("shift", ch.lower())
            elif ch in SHIFTED:
                base = SHIFTED[ch]
                self.key("shift", KEYS.get(base, base))
            else:
                self.key(KEYS.get(ch, ch))
            time.sleep(delay)

    def move(self, x, y):
        ax, ay = int(x / W * 32767), int(y / H * 32767)
        self.call("input-send-event", events=[
            {"type": "abs", "data": {"axis": "x", "value": ax}},
            {"type": "abs", "data": {"axis": "y", "value": ay}}])

    def click(self, x, y, button="left", double=False):
        self.move(x, y)
        for _ in range(2 if double else 1):
            self.call("input-send-event", events=[{"type": "btn", "data": {"button": button, "down": True}}])
            time.sleep(0.05)
            self.call("input-send-event", events=[{"type": "btn", "data": {"button": button, "down": False}}])
            time.sleep(0.08)


    def drag(self, x1, y1, x2, y2, steps=12):
        self.move(x1, y1)
        time.sleep(0.2)
        self.call("input-send-event", events=[{"type": "btn", "data": {"button": "left", "down": True}}])
        for i in range(1, steps + 1):
            self.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps)
            time.sleep(0.05)
        time.sleep(0.2)
        self.call("input-send-event", events=[{"type": "btn", "data": {"button": "left", "down": False}}])


def main(argv):
    if len(argv) < 2:
        sys.exit("uso: qmp.py shot [arq.png] | type 'texto' | key ctrl alt delete | click X Y [right|double] | powerdown | quit | status")
    q = Qmp()
    cmd = argv[1]
    if cmd == "shot":
        out = os.path.abspath(argv[2] if len(argv) > 2 else f"vm-{int(time.time())}.png")
        q.call("screendump", filename=out, format="png")
        print(out)
    elif cmd == "type":
        q.type_text(argv[2])
    elif cmd == "key":
        q.key(*argv[2:])
    elif cmd == "click":
        q.click(int(argv[2]), int(argv[3]), "right" if "right" in argv[4:] else "left", "double" in argv[4:])
    elif cmd == "drag":
        q.drag(int(argv[2]), int(argv[3]), int(argv[4]), int(argv[5]))
    elif cmd == "powerdown":
        q.call("system_powerdown")
    elif cmd == "quit":
        q.call("quit")
    elif cmd == "status":
        print(q.call("query-status")["status"])
    else:
        sys.exit(f"comando desconhecido: {cmd}")


if __name__ == "__main__":
    main(sys.argv)
