#!/usr/bin/env bash
# Builda as imagens usadas pela stack do Portainer.
# Rodar a partir da raiz do escrilex-back, com o escrilex-front ao lado.
set -euo pipefail

BACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT_DIR="${FRONT_DIR:-$(dirname "$BACK_DIR")/escrilex-front}"

if [ ! -f "$FRONT_DIR/package.json" ]; then
  echo "ERRO: front nao encontrado em $FRONT_DIR" >&2
  echo "Defina FRONT_DIR=/caminho/do/escrilex-front e rode de novo." >&2
  exit 1
fi

echo "==> build escrilex-api ($BACK_DIR)"
docker build -t escrilex-api:latest "$BACK_DIR"

echo "==> build escrilex-web ($FRONT_DIR)"
docker build -t escrilex-web:latest "$FRONT_DIR"

echo
echo "Imagens prontas. Agora atualize a stack no Portainer."
docker image ls --filter reference='escrilex-*'
