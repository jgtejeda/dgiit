FROM node:18-alpine

WORKDIR /app

# Instalamos http-server globalmente para servir el contenido
RUN npm install -g http-server

COPY . .

EXPOSE 8080

CMD ["http-server", "-p", "8080"]
