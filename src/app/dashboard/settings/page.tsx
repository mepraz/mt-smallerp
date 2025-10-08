
"use client";

import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { getSettings, updateSettings } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import type { SchoolSettings } from "@/lib/types";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = React.useState<SchoolSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    getSettings().then(s => {
        setSettings(s);
        if (s?.schoolLogoUrl) {
            setPreviewUrl(s.schoolLogoUrl);
        }
    });
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      await updateSettings(formData);
      toast({ title: "Success", description: "Settings updated successfully." });
      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update settings." });
    } finally {
      setIsLoading(false);
    }
  }

  if (settings === null) {
      return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
  }

  return (
    <div>
      <PageHeader title="School Settings" />
      <form ref={formRef} onSubmit={handleSaveSettings} className="space-y-8">
        <Card>
            <CardHeader>
            <CardTitle>General Information</CardTitle>
            <CardDescription>Update your school's general information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="schoolName">School Name</Label>
                        <Input 
                            id="schoolName" 
                            name="schoolName" 
                            defaultValue={settings.schoolName}
                            placeholder="e.g., Edify International School"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="schoolPhone">School Phone</Label>
                        <Input 
                            id="schoolPhone" 
                            name="schoolPhone" 
                            defaultValue={settings.schoolPhone}
                            placeholder="e.g., +977 1 1234567"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="schoolAddress">School Address</Label>
                    <Input 
                        id="schoolAddress" 
                        name="schoolAddress" 
                        defaultValue={settings.schoolAddress}
                        placeholder="e.g., Kathmandu, Nepal"
                    />
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>School Logo</CardTitle>
            <CardDescription>Upload your school's logo. It will appear on bills and marksheets.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            {previewUrl && (
              <div className="w-24 h-24 flex-shrink-0">
                <img src={previewUrl} alt="Logo Preview" className="w-full h-full object-contain rounded-md border" />
              </div>
            )}
            <div className="space-y-2 flex-grow">
              <Label htmlFor="logo">Upload Logo</Label>
              <Input id="logo" name="logo" type="file" accept="image/*" onChange={handleFileChange} />
              <p className="text-xs text-muted-foreground">Recommended format: PNG, JPG. Max size: 2MB.</p>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save All Settings
            </Button>
        </div>
      </form>
    </div>
  );
}
