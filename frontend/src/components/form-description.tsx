import { FC } from "react";
import { FileText } from "lucide-react";

interface FormDescriptionProps {
  title: string;
  placeholderText: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const FormDescription: FC<FormDescriptionProps> = ({  
  title,  
  placeholderText,  
  id,  
  value,  
  onChange 
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-black" />
        <label htmlFor={id} className="text-sm font-medium text-black">
          {title}
        </label>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholderText}
        className="w-full h-30 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 resize-none"
      />
    </div>
  );
};

export default FormDescription;
