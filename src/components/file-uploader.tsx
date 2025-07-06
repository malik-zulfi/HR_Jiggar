"use client";

import { useState, useRef } from 'react';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileUpload: (content: string) => void;
  onFileClear: () => void;
  acceptedFileTypes: string;
  label: string;
  id: string;
}

export default function FileUploader({ onFileUpload, onFileClear, acceptedFileTypes, label, id }: FileUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearFile = () => {
    setFileName(null);
    onFileClear();
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const parseFile = async (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (fileExtension === 'pdf') {
        const pdfjsLib = await import('pdfjs-dist');
        // Use a reliable CDN for the worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map((item: any) => item.str).join(' ');
        }
        onFileUpload(text);
        setFileName(file.name);
      } else if (fileExtension === 'docx') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        onFileUpload(result.value);
        setFileName(file.name);
      } else if (fileExtension === 'doc') {
          toast({ variant: "destructive", title: "Unsupported Format", description: ".doc files are not supported. Please convert to .docx, .pdf, or .txt" });
          clearFile();
      } else { // txt and other text formats
        const text = await file.text();
        onFileUpload(text);
        setFileName(file.name);
      }
    } catch (error) {
        console.error(`Error parsing ${fileExtension?.toUpperCase()} file:`, error);
        toast({ variant: "destructive", title: "Error", description: `Failed to parse ${fileExtension?.toUpperCase()} file.` });
        clearFile();
    }
  };

  const handleFile = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      const allowedTypes = acceptedFileTypes.split(',').map(t => t.trim().toLowerCase());
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (allowedTypes.includes(fileExtension)) {
        parseFile(file);
      } else {
        toast({ variant: "destructive", title: "Invalid File Type", description: `Please upload one of the following file types: ${acceptedFileTypes}` });
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFile(e.dataTransfer.files);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {fileName ? (
        <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileIcon className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={clearFile} className="h-6 w-6 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          id={id}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          className={cn(
            "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/10" : "border-input hover:border-primary/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={acceptedFileTypes}
            onChange={(e) => handleFile(e.target.files)}
          />
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-primary">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT</p>
        </div>
      )}
    </div>
  );
}
