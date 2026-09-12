FROM node:20-slim

# poppler-utils menyediakan perintah pdftoppm untuk konversi PDF ke gambar
RUN apt-get update && apt-get install -y poppler-utils && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
