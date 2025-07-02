import { Request, Response } from "express";
import initCore, { sfsConfig, UploadedFile } from "sfs-node";

export default function initFunctions({
  publicFolder,
  mask,
  getFileById,
  getFileByHash,
  createFile,
  logger,
}: sfsConfig) {
  const {
    resolveFilePath,
    idToUrl,
    urlToId,
    saveFile,
    deleteFileByHash,
    deleteFileById,
    getDiskUsage,
  } = initCore({
    publicFolder,
    mask,
    getFileById,
    getFileByHash,
    createFile,
    logger,
  });

  const getFile = async (req: Request, res: Response) => {
    const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
    const fileId = urlToId(fullUrl);
    try {
      const { filePath, fileName } = await resolveFilePath(fileId);
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.status(200).sendFile(filePath);
    } catch (err) {
      return res.status(404).send();
    }
  };

  const uploadFile = async (
    req,
    res: Response,
    options: {
      pathParamKey: string;
      fileParamKey: string;
      optimisticId?: string;
    } = {
      pathParamKey: "path",
      fileParamKey: "file",
    }
  ) => {
    if (!req.files) {
      return res.status(400).send("Request doesn't contain any files");
    }
    const { pathParamKey, fileParamKey } = options;
    try {
      console.log(req.files);

      const file = req.files[fileParamKey];
      const path = req.body[pathParamKey];

      const fileInfo = await saveFile(file, path, options.optimisticId);
      return res.status(200).send(fileInfo);
    } catch (err) {
      console.error(err);
      return res.status(500).send();
    }
  };

  const uploadFiles = async (
    req,
    res: Response,
    options: { pathParamKey: string } = {
      pathParamKey: "path",
    }
  ) => {
    if (!req.files) {
      return res.status(400).send("Request doesn't contain any files");
    }
    const { pathParamKey } = options;

    try {
      const path = req.body[pathParamKey];
      const files = req.files;
      const allFiles: UploadedFile[] = [];

      Object.values(files).forEach((file) => {
        if (Array.isArray(file)) {
          allFiles.push(...file);
        } else {
          // @ts-ignore
          allFiles.push(file);
        }
      });

      const fileInfo = await Promise.all(
        allFiles.map((file) => saveFile(file, path))
      );
      return res.status(200).send(fileInfo);
    } catch (err) {
      console.error(err);
      return res.status(500).send();
    }
  };

  const deleteFile = async (req, res) => {
    try {
      const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
      const fileId = urlToId(fullUrl);
      await deleteFileById(fileId);
      return res.status(200).send("ok");
    } catch (err) {
      console.error(err);
      return res.status(500).send();
    }
  };

  return {
    getFile,
    idToUrl,
    urlToId,
    saveFile,
    deleteFileByHash,
    deleteFileById,
    deleteFile,
    getDiskUsage,
    uploadFile,
    uploadFiles,
  };
}
