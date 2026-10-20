# VM Windows simples (QEMU/KVM)

Ambiente descartável para **observar o comportamento do dbForge original** e comparar com o dbForgeLinux.
Uso apenas para estudo comportamental, com licença ou trial oficial do próprio usuário. Nada aqui contorna licenciamento.

```bash
tools/vm/vm.sh setup                      # cria o disco (60G esparso)
tools/vm/vm.sh install ~/Win10.iso        # instala o Windows (janela do QEMU)
tools/vm/vm.sh stop && tools/vm/vm.sh snap base   # guarda um estado limpo
tools/vm/vm.sh run                        # usa a VM
tools/vm/vm.sh shot tela.png              # screenshot (para análise)
tools/vm/vm.sh type "texto" | key ctrl alt delete | click 640 400 [double|right]
tools/vm/vm.sh put dbforge-setup.exe      # copia arquivos (disco "share" no Windows, após reboot)
```

- Do Windows, o host é `10.0.2.2` (MySQL de teste: `10.0.2.2:33067`). RDP do host: `127.0.0.1:33389`.
- Dispositivos padrão (SATA, e1000e, VGA): o Windows instala sem drivers extras. `vm.sh virtio` baixa os drivers virtio opcionais.
- Para cliques precisos, ajuste a resolução do Windows para 1280x800 (ou exporte `VM_W`/`VM_H`).
- Win10 Enterprise Evaluation (90 dias) é o caminho mais simples. Win11 exige UEFI+TPM (`VM_UEFI=1` cobre só o UEFI).
- Variáveis: `VM_DIR VM_RAM VM_CPUS VM_DISK_SIZE VM_UEFI VM_DISPLAY VM_W VM_H`.
