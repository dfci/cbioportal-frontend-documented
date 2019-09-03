import * as React from "react";
import {observer} from "mobx-react";
import {MakeMobxView} from "../../../shared/components/MobxView";
import LoadingIndicator from "../../../shared/components/loadingIndicator/LoadingIndicator";
import PatientViewSelectableMutationTable from "./PatientViewSelectableMutationTable";
import {ServerConfigHelpers} from "../../../config/config";
import AppConfig from "appConfig";
import {MSKTab} from "../../../shared/components/MSKTabs/MSKTabs";
import {PatientViewPageStore} from "../clinicalInformation/PatientViewPageStore";
import PatientViewPage from "../PatientViewPage";
import SampleManager from "../sampleManager";
import {IColumnVisibilityDef} from "../../../shared/components/columnVisibilityControls/ColumnVisibilityControls";
import ErrorMessage from "../../../shared/components/ErrorMessage";
import VAFLineChart from "./VAFLineChart";
import {computed, observable} from "mobx";
import autobind from "autobind-decorator";
import {remoteData} from "../../../public-lib";
import PatientViewMutationsDataStore from "./PatientViewMutationsDataStore";
import {Mutation} from "../../../shared/api/generated/CBioPortalAPI";
import ReactSelect from "react-select";
import MutationOncoprint from "../oncoprint/MutationOncoprint";

export interface IPatientViewMutationsTabProps {
    store:PatientViewPageStore;
    mutationTableColumnVisibility?:{[columnId: string]: boolean};
    onMutationTableColumnVisibilityToggled:(columnId: string, columnVisibility?: IColumnVisibilityDef[]) => void;
    sampleManager:SampleManager|null;
}

@observer
export default class PatientViewMutationsTab extends React.Component<IPatientViewMutationsTabProps, {}> {
    private dataStore = new PatientViewMutationsDataStore(()=>this.props.store.mergedMutationDataIncludingUncalled);
    @observable.ref mutationsTable:PatientViewSelectableMutationTable|null = null;

    @autobind
    private tableRef(t:PatientViewSelectableMutationTable|null) {
        this.mutationsTable = t;
    }

    readonly selectedMutations = remoteData({
        await:()=>[this.props.store.mutationData, this.props.store.uncalledMutationData],
        invoke:()=>{
            if (!this.mutationsTable || this.mutationsTable.selectedMutations.length === 0) {
                return Promise.resolve(this.props.store.mergedMutationDataIncludingUncalled);
            } else {
                return Promise.resolve(this.mutationsTable.selectedMutations);
            }
        }
    });

    readonly vafLineChart = MakeMobxView({
        await:()=>[
            this.props.store.coverageInformation,
            this.selectedMutations,
            this.props.store.samples,
            this.props.store.mutationMolecularProfileId
        ],
        renderPending:()=><LoadingIndicator isLoading={true} size="small"/>,
        render:()=>(
            this.props.store.samples.result!.length > 1 ?
                (<VAFLineChart
                    mutations={this.selectedMutations.result!}
                    dataStore={this.dataStore}
                    samples={this.props.store.samples.result!}
                    coverageInformation={this.props.store.coverageInformation.result!}
                    mutationProfileId={this.props.store.mutationMolecularProfileId.result!}
                    sampleManager={this.props.sampleManager}
                />) :
                null
        ),
        showLastRenderWhenPending:true
    });

    @autobind
    private onTableRowClick(d:Mutation[]) {
        if (d.length) {
            this.dataStore.toggleHighlightedMutation({
                proteinChange:d[0].proteinChange,
                hugoGeneSymbol:d[0].gene.hugoGeneSymbol
            });
        }
    }
    @autobind
    private onTableRowMouseEnter(d:Mutation[]) {
        if (d.length) {
            this.dataStore.setMouseOverMutation({
                proteinChange:d[0].proteinChange,
                hugoGeneSymbol:d[0].gene.hugoGeneSymbol
            });
        }
    }
    @autobind
    private onTableRowMouseLeave() {
        this.dataStore.setMouseOverMutation(null);
    }

    private highlightedInTableOptions:{[value:string]:{label:string, value:boolean}} = {
        "true": {
            label: "Only show highlighted mutations in table",
            value: true
        },
        "false": {
            label: "Show all mutations in table",
            value: false
        }
    };

    readonly table = MakeMobxView({
        await:()=>[
            this.props.store.mutationData,
            this.props.store.uncalledMutationData,
            this.props.store.oncoKbAnnotatedGenes,
            this.props.store.studyIdToStudy
        ],
        renderPending:()=><LoadingIndicator isLoading={true} size="small"/>,
        render:()=>(
            <div>
                <div style={{ width: 314, float: "left", marginRight: 15, marginTop: -6 }} >
                    <ReactSelect
                        name="select whether table filters out non-highlighted mutations"
                        onChange={(option:any|null)=>{
                            if (option) {
                                this.dataStore.setOnlyShowHighlightedInTable(option.value);
                            }
                        }}
                        options={[this.highlightedInTableOptions.true, this.highlightedInTableOptions.false]}
                        clearable={false}
                        searchable={false}
                        value={this.highlightedInTableOptions[this.dataStore.getOnlyShowHighlightedInTable().toString()]}
                        styles={{
                            control: (provided:any)=>({
                                ...provided,
                                height:36,
                                minHeight:36,
                                border: "1px solid rgb(204,204,204)"
                            }),
                            menu: (provided:any)=>({
                                ...provided,
                                maxHeight: 400
                            }),
                            menuList: (provided:any)=>({
                                ...provided,
                                maxHeight:400
                            }),
                            placeholder:(provided:any)=>({
                                ...provided,
                                color: "#000000"
                            }),
                            dropdownIndicator:(provided:any)=>({
                                ...provided,
                                color:"#000000"
                            }),
                            option:(provided:any, state:any)=>{
                                return {
                                    ...provided,
                                    cursor:"pointer",
                                };
                            }
                        }}
                        theme={(theme:any)=>({
                            ...theme,
                            colors: {
                                ...theme.colors,
                                neutral80:"black",
                                //primary: theme.colors.primary50
                            },
                        })}
                    />
                </div>
                <PatientViewSelectableMutationTable
                    ref={this.tableRef}
                    dataStore={this.dataStore}
                    onRowClick={this.onTableRowClick}
                    onRowMouseEnter={this.onTableRowMouseEnter}
                    onRowMouseLeave={this.onTableRowMouseLeave}
                    studyIdToStudy={this.props.store.studyIdToStudy.result!}
                    sampleManager={this.props.sampleManager}
                    sampleIds={this.props.sampleManager ? this.props.sampleManager.getSampleIdsInOrder() : []}
                    uniqueSampleKeyToTumorType={this.props.store.uniqueSampleKeyToTumorType}
                    molecularProfileIdToMolecularProfile={this.props.store.molecularProfileIdToMolecularProfile.result}
                    variantCountCache={this.props.store.variantCountCache}
                    indexedVariantAnnotations={this.props.store.indexedVariantAnnotations}
                    discreteCNACache={this.props.store.discreteCNACache}
                    mrnaExprRankCache={this.props.store.mrnaExprRankCache}
                    oncoKbEvidenceCache={this.props.store.oncoKbEvidenceCache}
                    pubMedCache={this.props.store.pubMedCache}
                    genomeNexusCache={this.props.store.genomeNexusCache}
                    genomeNexusMyVariantInfoCache={this.props.store.genomeNexusMyVariantInfoCache}
                    mrnaExprRankMolecularProfileId={this.props.store.mrnaRankMolecularProfileId.result || undefined}
                    discreteCNAMolecularProfileId={this.props.store.molecularProfileIdDiscrete.result}
                    data={this.props.store.mergedMutationDataIncludingUncalled}
                    downloadDataFetcher={this.props.store.downloadDataFetcher}
                    mutSigData={this.props.store.mutSigData.result}
                    myCancerGenomeData={this.props.store.myCancerGenomeData}
                    hotspotData={this.props.store.indexedHotspotData}
                    cosmicData={this.props.store.cosmicData.result}
                    oncoKbData={this.props.store.oncoKbData}
                    oncoKbCancerGenes={this.props.store.oncoKbCancerGenes}
                    civicGenes={this.props.store.civicGenes}
                    civicVariants={this.props.store.civicVariants}
                    userEmailAddress={ServerConfigHelpers.getUserEmailAddress()}
                    enableOncoKb={AppConfig.serverConfig.show_oncokb}
                    enableFunctionalImpact={AppConfig.serverConfig.show_genomenexus}
                    enableHotspot={AppConfig.serverConfig.show_hotspot}
                    enableMyCancerGenome={AppConfig.serverConfig.mycancergenome_show}
                    enableCivic={AppConfig.serverConfig.show_civic}
                    columnVisibility={this.props.mutationTableColumnVisibility}
                    columnVisibilityProps={{
                        onColumnToggled: this.props.onMutationTableColumnVisibilityToggled
                    }}
                />
            </div>
        )
    });
    render() {
        return (
            <div>
                <div style={{marginBottom:25}}>
                    {this.vafLineChart.component}
                </div>
                <hr/>
                <MutationOncoprint store={this.props.store} sampleManager={this.props.sampleManager}/>
                <hr/>
                {this.table.component}
            </div>
        );
    }
}