import { env } from '@shared/env';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export const createElasticTransport = () => {
  return new ElasticsearchTransport({
    level: 'info',
    indexPrefix: 'logs',
    indexSuffixPattern: 'YYYY.MM.DD',
    clientOpts: {
      node: env.ELASTICSEARCH_URL,
    },
  });
};
