#!/bin/bash
# prepara la raspberry: instala docker y ajusta el .env a la version del sistema
set -e
cd "$(dirname "$0")"

. /etc/os-release
echo "arquitectura: $(uname -m) | sistema: $VERSION_CODENAME"
if [ "$(uname -m)" != "aarch64" ]; then
  echo "ojo: el sistema no es de 64 bits, las imagenes esperan aarch64"
  exit 1
fi

if ! command -v docker >/dev/null; then
  echo "instalando docker..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
fi
sudo usermod -aG docker "$USER"
# docker parte solo al encender la raspberry
sudo systemctl enable --now docker

if [ ! -f .env ]; then
  cp .env.example .env
  echo "complete el .env con API_URL y DEVICE_TOKEN"
fi
sed -i "s/^DEBIAN=.*/DEBIAN=$VERSION_CODENAME/" .env

echo "listo. sal de ssh (exit) y vuelve a entrar para usar docker sin sudo"
