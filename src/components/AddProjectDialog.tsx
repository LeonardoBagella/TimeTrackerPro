
import React, { useState, useEffect } from 'react';
import { useProjects } from '@/context/ProjectContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colors = [
  '#3b82f6', '#8b5cf6', '#ef4444', '#10b981', 
  '#f59e0b', '#ec4899', '#6366f1', '#84cc16'
];

const AddProjectDialog: React.FC<AddProjectDialogProps> = ({ open, onOpenChange }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const { addProject } = useProjects();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && user) {
      fetchAvailableProjects();
    }
  }, [open, user]);

  const fetchAvailableProjects = async () => {
    if (!user) return;
    
    setLoadingProjects(true);
    try {
      // Get all projects
      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      if (projectsError) throw projectsError;

      // Get projects user is already member of
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // Filter out projects user is already member of
      const memberProjectIds = new Set(memberProjects?.map(m => m.project_id) || []);
      const available = (allProjects || []).filter(p => !memberProjectIds.has(p.id));
      
      setAvailableProjects(available);
    } catch (error) {
      console.error('Error fetching available projects:', error);
      toast({
        title: "Error",
        description: "Failed to load available projects",
        variant: "destructive"
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleJoinProject = async (projectId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: user.id });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Joined project successfully!"
      });

      onOpenChange(false);
      window.location.reload(); // Refresh to show new project
    } catch (error) {
      console.error('Error joining project:', error);
      toast({
        title: "Error",
        description: "Failed to join project",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a project name",
        variant: "destructive"
      });
      return;
    }

    addProject({
      name: name.trim(),
      description: description.trim(),
      color: selectedColor
    });

    toast({
      title: "Success",
      description: "Project added successfully!"
    });

    // Reset form
    setName('');
    setDescription('');
    setSelectedColor(colors[0]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Gestione Progetti</DialogTitle>
          <DialogDescription>
            Crea un nuovo progetto o unisciti a uno esistente.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Crea Nuovo</TabsTrigger>
            <TabsTrigger value="join">Unisciti</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Nome Progetto</Label>
                <Input
                  id="name"
                  placeholder="Inserisci nome progetto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Descrizione</Label>
                <Textarea
                  id="description"
                  placeholder="Descrizione progetto (opzionale)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Colore Progetto</Label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor === color 
                          ? 'border-gray-800 scale-110' 
                          : 'border-gray-300 hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  Crea Progetto
                </Button>
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="join" className="mt-4">
            <div className="space-y-4">
              {loadingProjects ? (
                <div className="text-center py-8 text-muted-foreground">
                  Caricamento progetti...
                </div>
              ) : availableProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessun progetto disponibile a cui unirti
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableProjects.map((project) => (
                    <div 
                      key={project.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: project.color }}
                        />
                        <div>
                          <h4 className="font-medium">{project.name}</h4>
                          {project.description && (
                            <p className="text-sm text-muted-foreground">{project.description}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleJoinProject(project.id)}
                      >
                        Unisciti
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex justify-end pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                >
                  Chiudi
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectDialog;
