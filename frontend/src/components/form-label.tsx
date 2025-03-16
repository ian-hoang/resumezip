import { FC } from "react";
import { LucideIcon } from "lucide-react";

interface FormLabelProps {
  icon: LucideIcon;
  title: string;
  placeholderText: string;
  type?: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FormLabel: FC<FormLabelProps> = ({  icon: Icon,  title,  placeholderText,  type = "text",  id,  value,  onChange }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-gray-500" />
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {title}
        </label>
      </div>
      <input id={id} type={type} value={value} onChange={onChange}
        placeholder={placeholderText}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
      />
    </div>
  );
};

export default FormLabel;
