import { FC, useState } from "react";
import { FileText, WandSparkles, Loader2 } from "lucide-react";

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
  onChange,
}) => {
  const [loading, setLoading] = useState(false); // Loading state

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

      const newText = normalizeText(value);

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

    setLoading(true); // Start loading

    try {
      const response = await fetch("https://api.resumezip.io/improve-job-desc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobDesc: value }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch AI response");
      }

      const data = await response.json();
      onChange({ target: { value: data.optimizedText } } as React.ChangeEvent<HTMLTextAreaElement>);
    } catch (error) {
      console.error("Error optimizing text:", error);
    } finally {
      setLoading(false); // Stop loading
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
      {/* AI Button with Loading Spinner */}
      <button
        onClick={onAiFinish}
        disabled={loading}
        className={`absolute bottom-2 right-2 flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium px-2 py-1 rounded-md shadow-sm transition-transform duration-200 cursor-pointer active:scale-110 ${
          loading ? "opacity-75 cursor-not-allowed" : ""
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" /> // Loading spinner
        ) : (
          <>
            <WandSparkles className="h-4 w-4" />
            Zip It
          </>
        )}
      </button>
    </div>
  );
};

export default FormDescription;
