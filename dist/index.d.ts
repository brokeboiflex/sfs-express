import { Request, Response } from "express";
import { sfsConfig, UploadedFile } from "sfs-node";
export default function initFunctions({ publicFolder, mask, getFileById, getFileByHash, createFile, logger, allowDuplicates, }: sfsConfig): {
    getFile: (req: Request, res: Response) => Promise<void | Response<any, Record<string, any>>>;
    idToUrl: (id: import("sfs-node").sfsFileId) => string;
    urlToId: (url: string) => string;
    saveFile: (file: UploadedFile, filePath?: string, id?: import("sfs-node").sfsFileId) => Promise<import("sfs-node").sfsFile>;
    prepareOptimisticUpload: (req: any, res: any) => Promise<any>;
    deleteFileByHash: (hash: string) => Promise<void>;
    deleteFileById: (id: string) => Promise<void>;
    deleteFile: (req: any, res: any) => Promise<any>;
    getDiskUsage: (req: any, res: any) => Promise<import("check-disk-space").DiskSpace>;
    uploadFile: (req: any, res: Response, options?: {
        pathParamKey: string;
        fileParamKey: string;
        optimisticIdKey: string;
    }) => Promise<Response<any, Record<string, any>>>;
    uploadFiles: (req: any, res: Response, options?: {
        pathParamKey: string;
    }) => Promise<Response<any, Record<string, any>>>;
};
