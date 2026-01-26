import Header from '@/components/home/Header';

export default function Page() {
  return (
    <div className="mt-5">
      <Header />
      <div className="flex mx-auto justify-center items-center mt-10">
        <div className="text-center">
          <p className="text-lg font-semibold">Sign In</p>
          <p className="text-gray-600 mt-2">Authentication not configured</p>
        </div>
      </div>
    </div>
  );
}
