"use client";

import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white p-5">
      <div className="flex items-center mb-5">
        <button onClick={() => router.back()} className="mr-3">
          <IoArrowBack size={24} />
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>
      <p className="text-gray-400">Settings page placeholder.</p>
    </div>
  );
}