# Railway builds from this file. The base image comes from the AWS public mirror of the official
# Node image, so builds don't depend on Docker Hub, whose anonymous pull limit was failing deploys.
FROM public.ecr.aws/docker/library/node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
