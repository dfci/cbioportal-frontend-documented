import { CBioPortalAPIInternal } from 'cbioportal-ts-api-client';
import { AppStore } from 'AppStore';
import { getServerConfig } from 'config/config';

function proxyColumnStore(client: any, endpoint: string) {
    const method = `${endpoint}UsingPOSTWithHttpInfo`;
    const old = client[method];
    client[method] = function(params: any) {
        params.$domain = `http://${
            getServerConfig().base_url
        }/api/column-store`;
        const url = old.apply(this, [params]);
        return url;
    };
}

const internalClient = new CBioPortalAPIInternal();

export const internalClientColumnStore = new CBioPortalAPIInternal();

proxyColumnStore(internalClientColumnStore, 'fetchMutatedGenes');
proxyColumnStore(internalClientColumnStore, 'fetchFilteredSamples');
proxyColumnStore(internalClientColumnStore, 'fetchClinicalDataCounts');

export default internalClient;
