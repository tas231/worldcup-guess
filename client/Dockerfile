FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Read variables from .env files or build args natively
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
