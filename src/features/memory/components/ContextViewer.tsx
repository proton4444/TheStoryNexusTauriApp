import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type Props = {
    injectedContext: string[];
    extractedEntities: string[];
};

export function ContextViewer({ injectedContext, extractedEntities }: Props) {
    if (injectedContext.length === 0 && extractedEntities.length === 0) {
        return null;
    }

    const parseEntity = (entity: string) => {
        const colonIndex = entity.indexOf(':');
        if (colonIndex > 0) {
            return {
                category: entity.substring(0, colonIndex).trim(),
                content: entity.substring(colonIndex + 1).trim()
            };
        }
        return { category: 'Entity', content: entity };
    };

    return (
        <Card className="mt-4">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Memory Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {injectedContext.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Injected Context
                        </h4>
                        <ScrollArea className="h-32 rounded border p-2 bg-muted/50">
                            <ul className="space-y-2">
                                {injectedContext.map((context, i) => (
                                    <li key={i} className="text-sm border-b last:border-0 pb-1 last:pb-0 border-border/50">
                                        {context}
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </div>
                )}

                {injectedContext.length > 0 && extractedEntities.length > 0 && (
                    <Separator />
                )}

                {extractedEntities.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Extracted Entities
                        </h4>
                        <div className="rounded-md border">
                            <ScrollArea className="h-[200px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">Category</TableHead>
                                            <TableHead>Content</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {extractedEntities.map((entity, i) => {
                                            const { category, content } = parseEntity(entity);
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium capitalize text-xs">
                                                        <Badge variant="outline">{category}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{content}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
