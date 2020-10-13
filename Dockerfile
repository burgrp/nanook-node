FROM node:10-alpine AS builder

WORKDIR /nanook

RUN apk add python alpine-sdk linux-headers

COPY package-lock.json package.json ./

RUN npm install

FROM node:10-alpine

COPY --from=builder /nanook /nanook

WORKDIR /nanook
COPY config.json .
COPY src src/

CMD [ "node", "--inspect=0.0.0.0:9229", "src/main.js" ]
