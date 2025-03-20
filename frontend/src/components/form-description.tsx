import { FC } from "react";
import { FileText, WandSparkles } from "lucide-react";


interface FormDescriptionProps {
  title: string;
  placeholderText: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onAiFinish?: () => void; // Callback for AI button
}

const FormDescription: FC<FormDescriptionProps> = ({
  title,
  placeholderText,
  id,
  value,
  onChange,
}) => {
  const normalizeText = (text: string) => {
    return text
      .split("\n")
      .map((line) => {
        if (line.trim()) {
          if (line === "•") {
            return line;
          }
          if (/^•([^\s]|$)/.test(line)) {
            return line.replace(/^•/, "• ");
          }
          return line.startsWith("• ") ? line : `• ${line}`;
        }
        return line;
      })
      .join("\n");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      let newText = normalizeText(value);

      const updatedValue =
        newText.substring(0, start) +
        (newText[start - 1] === "\n" ? "" : "\n• ") +
        newText.substring(end);

      onChange({
        target: { value: updatedValue },
      } as React.ChangeEvent<HTMLTextAreaElement>);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 3;
      }, 0);
    }
  };

  const onAiFinish = async () => {
    if (!value.trim()) return;
  
    try {
      const response = await fetch("http://localhost:8080/ai-gen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: value }),
      });
  
      if (!response.ok) {
        throw new Error("Failed to fetch AI response");
      }
  
      const data = await response.json();
      onChange({ target: { value: data.optimizedText } } as React.ChangeEvent<HTMLTextAreaElement>);
    } catch (error) {
      console.error("Error optimizing text:", error);
    }
  };

  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {title}
        </label>
      </div>
      <textarea
        id={id}
        value={normalizeText(value)}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholderText}
        className="w-full h-30 rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 resize-none transition-all"
      />
      {/* Smaller AI Finish Button */}
      <button
        onClick={onAiFinish}
        className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-md shadow-sm transition-transform duration-200 cursor-pointer active:scale-110"
      >
        <WandSparkles className="h-3 w-3" />
        Zip It
      </button>
    </div>
  );
};

export default FormDescription;
