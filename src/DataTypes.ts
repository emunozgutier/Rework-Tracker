export interface PcbFlavor {
    database_id: string;
    name: string;
    rev: string;
    bom: string;
}

export interface Project {
    database_id: string;
    name: string;
    key: string;
    siliconVersions: string[];
    siliconCorners: string[];
    boardNumberFormat: string;
    flavors: PcbFlavor[];
}
