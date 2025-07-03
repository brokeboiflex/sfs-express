import { Request, Response } from "express";
import initCore, { sfsConfig, UploadedFile } from "sfs-node";

export default function initFunctions({
  publicFolder,
  mask,
  getFileById,
  getFileByHash,
  createFile,
  logger,
  allowDuplicates,
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
    allowDuplicates,
  });

  const optimisticUrls = new Set();

  const getFile = async (req: Request, res: Response) => {
    let fullUrl;
    try {
      const id = req.params.id;
      fullUrl = idToUrl(id);
      logger &&
        logger(
          "SFS Express: trying to return requested file: " + fullUrl,
          "info"
        );
      if (optimisticUrls.has(fullUrl)) {
        return res.status(428);
      }
      const fileId = urlToId(fullUrl);
      const { filePath, fileName } = await resolveFilePath(fileId);
      logger &&
        logger(
          `SFS Express: sedning file '${fileName}' with path '${filePath}'`
        );

      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      return res.status(200).sendFile(filePath);
    } catch (err) {
      logger && logger("SFS Express: unable to return file:" + fullUrl);
      logger && logger(err);

      return res.status(404).send();
    }
  };

  const prepareOptimisticUpload = async (req, res) => {
    const id = req.body.id;
    const optimisticUrl = idToUrl(id);
    try {
      optimisticUrls.add(optimisticUrl);
      return res.status(200).send(optimisticUrl);
    } catch (err) {
      logger && logger(err, "error");
      return res.status(500).send();
    }
  };

  const uploadFile = async (
    req,
    res: Response,
    options: {
      pathParamKey: string;
      fileParamKey: string;
      optimisticIdKey: string;
      additionalData: any;
    } = {
      pathParamKey: "path",
      fileParamKey: "file",
      optimisticIdKey: "id",
      additionalData: {},
    }
  ) => {
    if (!req.files) {
      return res.status(400).send("Request doesn't contain any files");
    }
    const { pathParamKey, fileParamKey, optimisticIdKey, additionalData } =
      options;
    const file = req.files[fileParamKey];
    const path = req.body[pathParamKey];
    const id = req.body[optimisticIdKey];
    let optimisticUrl;
    try {
      if (id) {
        optimisticUrl = idToUrl(id);
      }
      const fileInfo = await saveFile(file, {
        filePath: path,
        id,
        additionalData,
      });
      if (fileInfo && optimisticUrl) {
        optimisticUrls.delete(optimisticUrl); // Delete the URL, not the id
      }
      return res.status(200).send(fileInfo);
    } catch (err) {
      logger && logger(err, "error");

      if (optimisticUrl) {
        optimisticUrls.delete(optimisticUrl); // Delete the URL, not the id
      }
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
      logger && logger(err, "error");

      return res.status(500).send();
    }
  };

  const deleteFile = async (req, res) => {
    try {
      const id = req.params.id;
      const fullUrl = idToUrl(id);
      const fileId = urlToId(fullUrl);
      await deleteFileById(fileId);
      return res.status(200).send("ok");
    } catch (err) {
      logger && logger(err, "error");
      return res.status(500).send();
    }
  };

  return {
    getFile,
    idToUrl,
    urlToId,
    saveFile,
    prepareOptimisticUpload,
    deleteFileByHash,
    deleteFileById,
    deleteFile,
    getDiskUsage,
    uploadFile,
    uploadFiles,
  };
}
