import { lookupArchive } from '@subsquid/archive-registry';
import { ProcessorConfig } from '../processorConfig';

const config: ProcessorConfig = {
    chainName: 'moonbeam',
    prefix: 'moonbeam',
    dataSource: {
        //archive: 'https://moonbeam.archive.subsquid.io/graphql',
        //chain: 'wss://moonbeam.public.blastapi.io'
        archive: lookupArchive('moonbeam', { type: 'Substrate' })
    },
    blockRange: //undefined
    {
        from: 3428487
    }
};

export default config;

