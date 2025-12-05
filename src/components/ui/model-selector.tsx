import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { AIModel, AllowedModel } from "@/types/story";

interface ModelSelectorProps {
    models: AIModel[];
    value?: AllowedModel;
    onSelect: (model: AllowedModel | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function ModelSelector({
    models,
    value,
    onSelect,
    placeholder = "Select a model...",
    disabled = false,
}: ModelSelectorProps) {
    const [open, setOpen] = React.useState(false);

    // Group models by provider
    const groupedModels = React.useMemo(() => {
        const groups: Record<string, AIModel[]> = {};
        for (const model of models) {
            const provider = model.provider;
            if (!groups[provider]) {
                groups[provider] = [];
            }
            groups[provider].push(model);
        }
        return groups;
    }, [models]);

    const providerLabels: Record<string, string> = {
        openai: "OpenAI",
        openrouter: "OpenRouter",
        local: "Local",
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {value ? (
                        <span className="truncate">
                            {value.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                                ({providerLabels[value.provider] || value.provider})
                            </span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search models..." />
                    <CommandList>
                        <CommandEmpty>No model found.</CommandEmpty>
                        {Object.entries(groupedModels).map(([provider, providerModels]) => (
                            <CommandGroup key={provider} heading={providerLabels[provider] || provider}>
                                {providerModels.map((model) => (
                                    <CommandItem
                                        key={model.id}
                                        value={`${model.name} ${model.id}`}
                                        onSelect={() => {
                                            const newValue: AllowedModel = {
                                                id: model.id,
                                                name: model.name,
                                                provider: model.provider,
                                            };
                                            onSelect(value?.id === model.id ? undefined : newValue);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value?.id === model.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="truncate">{model.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
