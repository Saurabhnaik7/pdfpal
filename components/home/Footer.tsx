import Logo from '../ui/Logo';
import Link from 'next/link';

const Footer = () => {
  return (
    <div className="border-t-[rgba(0,0,0,0.20)] border-t border-solid pt-4">
      <div className="container flex flex-col sm:flex-row justify-between items-center sm:h-[77px] pt-3 pb-6 sm:pt-0 px-2 sm:px-0 sm:space-y-0 space-y-4 mx-auto">
        <Logo />
        <span className="sm:text-xl text-lg sm:text-left text-center">
          © {new Date().getFullYear()} PDFPal. All rights reserved.
        </span>
        <div className="flex items-center gap-[22px] sm:gap-[39px]">
          <div className="flex space-x-4 pb-4 sm:pb-0">
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
