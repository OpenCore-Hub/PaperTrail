import { generateUploadButton, generateUploadDropzone } from "@uploadthing/react";
import { OurFileRouter } from "./uploadthing";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
