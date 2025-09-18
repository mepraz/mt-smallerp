
"use client";

import * as React from "react";
import Link from "next/link";
import { Search as SearchIcon, Loader2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getStudents, getClasses } from "@/lib/data";
import type { Student, Class } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

export function Search() {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Student[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  const debouncedQuery = useDebounce(query, 300);

  React.useEffect(() => {
    // Fetch classes once when the component mounts
    getClasses().then(setClasses);
  }, []);

  React.useEffect(() => {
    if (debouncedQuery) {
      setLoading(true);
      getStudents({ name: debouncedQuery }).then((data) => {
        setResults(data);
        setLoading(false);
        if(data.length > 0) {
            setIsPopoverOpen(true);
        }
      });
    } else {
      setResults([]);
      setIsPopoverOpen(false);
    }
  }, [debouncedQuery]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!e.target.value) {
        setIsPopoverOpen(false);
    }
  }

  const handleLinkClick = () => {
    setQuery("");
    setResults([]);
    setIsPopoverOpen(false);
  }

  const findClassName = (classId: string) => {
    const studentClass = classes.find(c => c.id === classId);
    if (!studentClass) return "";
    const displayName = studentClass.section ? `${studentClass.name} - ${studentClass.section}` : studentClass.name;
    return `(${displayName})`;
  };

  return (
    <div className="relative ml-auto flex-1 md:grow-0">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search students by name..."
                        className="w-full rounded-lg bg-secondary pl-8 md:w-[200px] lg:w-[320px]"
                        value={query}
                        onChange={handleQueryChange}
                    />
                </div>
            </PopoverTrigger>
             <PopoverContent className="p-0 w-[320px]" align="start">
                <Command>
                    <CommandList>
                        {loading && <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin"/></div>}
                        {!loading && results.length === 0 && query && (
                            <CommandEmpty>No student found.</CommandEmpty>
                        )}
                        {!loading && results.length > 0 && (
                            <CommandGroup heading="Students">
                                {results.map((student) => (
                                    <Link key={student.id} href={`/dashboard/students/${student.id}`} onClick={handleLinkClick} passHref>
                                        <CommandItem value={`${student.name} ${findClassName(student.classId)}`}>
                                            <User className="mr-2 h-4 w-4" />
                                            <span>{student.name} <span className="text-muted-foreground text-xs">{findClassName(student.classId)}</span></span>
                                        </CommandItem>
                                    </Link>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
             </PopoverContent>
        </Popover>
    </div>
  );
}
