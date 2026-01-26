'use client';

import { useRouter } from 'next/navigation';
import DocIcon from '@/components/ui/DocIcon';
import { formatDistanceToNow } from 'date-fns';
import { useState, useRef } from 'react';

export default function DashboardClient({ docsList }: { docsList: any }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (docsList.length >= 3) {
      setError("You've reached your limit for PDFs.");
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await ingestPdf(file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload PDF');
      setLoading(false);
    }
  }

  async function ingestPdf(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/ingestPdf', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to ingest PDF');
    }

    const data = await res.json();
    router.push(`/document/${data.id}`);
  }

  return (
    <div className="mx-auto flex flex-col gap-4 container mt-10">
      <h1 className="text-4xl leading-[1.1] tracking-tighter font-medium text-center">
        Chat With Your PDFs
      </h1>
      {docsList.length > 0 && (
        <div className="flex flex-col gap-4 mx-10 my-5">
          <div className="flex flex-col shadow-sm border divide-y-2 sm:min-w-[650px] mx-auto">
            {docsList.map((doc: any) => (
              <div
                key={doc.id}
                className="flex justify-between p-3 hover:bg-gray-100 transition sm:flex-row flex-col sm:gap-0 gap-3"
              >
                <button
                  onClick={() => router.push(`/document/${doc.id}`)}
                  className="flex gap-4"
                >
                  <DocIcon />
                  <span>{doc.fileName}</span>
                </button>
                <span>{formatDistanceToNow(doc.createdAt)} ago</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {docsList.length > 0 ? (
        <h2 className="text-3xl leading-[1.1] tracking-tighter font-medium text-center">
          Or upload a new PDF
        </h2>
      ) : (
        <h2 className="text-3xl leading-[1.1] tracking-tighter font-medium text-center mt-5">
          No PDFs found. Upload a new PDF below!
        </h2>
      )}
      <div className="mx-auto flex justify-center mt-5">
        {loading ? (
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-lg shadow rounded-md text-black transition ease-in-out duration-150 cursor-not-allowed"
          >
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-black"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Ingesting your PDF...
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <label className="flex items-center justify-center px-6 py-3 border-2 border-dashed border-gray-400 rounded-lg hover:border-gray-600 cursor-pointer transition bg-gray-50 hover:bg-gray-100">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v12a4 4 0 01-4 4H12a4 4 0 01-4-4v-2.172a4 4 0 01.586-2.828l6.293-6.293a4 4 0 015.656 0l2.828 2.829a4 4 0 005.656 0l6.293-6.293a4 4 0 01.586 2.829V28z"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  Click to upload PDF
                </p>
                <p className="text-xs text-gray-500">PDF up to 50MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
