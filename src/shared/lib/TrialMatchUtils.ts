import * as _ from 'lodash';
import {ITrialMatchGene, ITrialMatchGeneData, ITrialMatchVariant, ITrialMatchVariantData} from "shared/model/TrialMatch.ts";
import trialMatchClient from "shared/api/trialMatchClientInstance";
import { DiscreteCopyNumberData } from "shared/api/generated/CBioPortalAPI";

type MutationSpec = {gene:{hugoGeneSymbol: string}, proteinChange: string, sampleId:string};

/**
 * Asynchronously adds the given variant from a gene to the variant map specified.
 */
function addTrialMatchVariant(variantMap: ITrialMatchVariant, sampleId: string,
                              variantName: string, geneSymbol: string): Promise<void> {
    return trialMatchClient.getVariant(sampleId, variantName, geneSymbol)
        .then(function(result: ITrialMatchVariantData) {
            if (result) {
                if (!variantMap[sampleId]) {
                    variantMap[sampleId] = {};
                }
                if (!variantMap[sampleId][geneSymbol]) {
                    variantMap[sampleId][geneSymbol] = {};
                }
                variantMap[sampleId][geneSymbol][variantName] = result;
            }
        });
}

/**
 * Asynchronously return a map with Trial Match information from the genes given.
 */
export function getTrialMatchGenes(geneSymbols: Array<string>): Promise<ITrialMatchGene> {

    const trialMatchGenes: ITrialMatchGene = {};

    // Assemble a list of promises, each of which will retrieve a batch of genes
    const promises: Array<Promise<Array<ITrialMatchGeneData>>> = [];
    let ids: Array<string> = [];
    geneSymbols.forEach(function(geneSymbol: string) {
        //Encode "/" characters
        geneSymbol = geneSymbol.replace(/\//g,'%2F');
        // Check if we already have it in the cache
        if (trialMatchGenes.hasOwnProperty(geneSymbol)) {
            return;
        }

        // Add the symbol to the list
        ids.push(geneSymbol);

        // To prevent the request from growing too large, we send it off
        // when it reaches this limit and start a new one
        if (ids.length >= 400) {
            const requestIds = ids.join();
            promises.push(trialMatchClient.getTrialMatchGenesBatch(requestIds));
            ids = [];
        }
    });
    if (ids.length > 0) {
        const requestIds = ids.join();
        promises.push(trialMatchClient.getTrialMatchGenesBatch(requestIds));
    }

    // We're waiting for all promises to finish, then return civicGenes
    return Promise.all(promises).then(function(responses) {
        for (const res in responses) {
            if (responses) {
                const arrayTrialMatchGenes: Array<ITrialMatchGeneData> = responses[res];
                arrayTrialMatchGenes.forEach((trialMatchGene) => {
                    trialMatchGenes[trialMatchGene.hugoSymbol] = trialMatchGene;
                });
            }
        }
    }).then(function() {
        return trialMatchGenes;
    });
}

/**
 * Asynchronously retrieve a map with Civic information from the mutationSpecs given for all genes in civicGenes.
 * If no mutationSpecs are given, then return the Civic information of all the CNA variants of the genes in civicGenes.
 */
export function getTrialMatchVariants(trialMatchGenes: ITrialMatchGene, mutationSpecs?: Array<MutationSpec>): Promise<ITrialMatchVariant> {

    const trialMatchVariants: ITrialMatchVariant = {};
    const promises: Array<Promise<void>> = [];

    if (mutationSpecs) {
        const calledVariants: Set<any> = new Set([]);
        for (const mutation of mutationSpecs) {
            const geneSymbol = mutation.gene.hugoGeneSymbol;
            const geneEntry = trialMatchGenes[geneSymbol];
            const proteinChanges = [mutation.proteinChange];
            // Match any other variants after splitting the name on + or /
            const split = mutation.proteinChange.split(/[+\/]/);
            proteinChanges.push(split[0]);
            for (const proteinChange of proteinChanges) {
                if (geneEntry && geneEntry.variants[proteinChange]) {
                    if (!calledVariants.has(geneEntry.hugoSymbol + proteinChange)) { //Avoid calling the same variant,
                        calledVariants.add(geneEntry.hugoSymbol + proteinChange);
                        const sampleIds = geneEntry.variants[proteinChange].split(",");
                        sampleIds.forEach(sampleId =>
                            promises.push(addTrialMatchVariant(trialMatchVariants, sampleId, proteinChange, geneSymbol))
                        );
                    }
                }
            }
        }
    }
    else {
        for (const geneName in trialMatchGenes) {
            if (trialMatchGenes) {
                const geneEntry = trialMatchGenes[geneName];
                const geneVariants = geneEntry.variants;
                if (!_.isEmpty(geneVariants)) {
                    for (const variantName in geneVariants) {
                        // Only retrieve CNA variants
                        if (variantName === 'AMPLIFICATION' || variantName === 'DELETION') {
                            const sampleIds = geneEntry.variants[variantName].split(",");
                            sampleIds.forEach(sampleId =>
                                promises.push(addTrialMatchVariant(trialMatchVariants, sampleId, variantName, geneName))
                            );
                        }
                    }
                }
            }
        }
    }

    // We're explicitly waiting for all promises to finish (done or fail).
    // We are wrapping them in another promise separately, to make sure we also
    // wait in case one of the promises fails and the other is still busy.
    return Promise.all(promises).then(function() {
        return trialMatchVariants;
    });
}

/**
 * Build a Civic Entry with the data given.
 */
export function buildTrialMatchEntry(geneEntry: ITrialMatchGeneData, geneVariants: {[name: string]: ITrialMatchVariantData}) {
    return {
        name: geneEntry.hugoSymbol,
        variants: geneVariants
    };
}

export function getTrialMatchCNAVariants(copyNumberData:DiscreteCopyNumberData[], geneSymbol: string, trialMatchVariants:ITrialMatchVariant): {[name: string]: ITrialMatchVariantData} {
    let geneVariants: {[name: string]: ITrialMatchVariantData} = {};
    if (copyNumberData[0].alteration === 2) {
        for (const alteration in trialMatchVariants[geneSymbol]) {
            if (alteration === "AMPLIFICATION") {
                geneVariants = {[copyNumberData[0].sampleId]: trialMatchVariants[copyNumberData[0].sampleId][geneSymbol][alteration]};
            }
        }
    } else if (copyNumberData[0].alteration === -2) {
        for (const alteration in trialMatchVariants[geneSymbol]) {
            if (alteration === "DELETION") {
                geneVariants = {[copyNumberData[0].sampleId]: trialMatchVariants[copyNumberData[0].sampleId][geneSymbol][alteration]};
            }
        }
    }
    return geneVariants;
}