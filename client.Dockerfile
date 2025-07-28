FROM node:lts-alpine

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

COPY .yarn/ ./.yarn/
COPY .yarnrc.yml ./
COPY yarn.lock ./

COPY types/ ./types/
COPY client/ ./client/

RUN yarn install

CMD ["yarn", "client:start"]