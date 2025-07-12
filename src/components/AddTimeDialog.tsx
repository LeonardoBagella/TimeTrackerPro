
import React, { useState } from 'react';
import { useProjects } from '@/context/ProjectContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AddTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const taskTypes = [
  { value: "analysis", label: "Analysis" },
  { value: "development", label: "Development" },
  { value: "meeting", label: "Meeting" }
];

const AddTimeDialog: React.FC<AddTimeDialogProps> = ({ open, onOpenChange }) => {
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState('4');
  const [taskType, setTaskType] = useState('development');
  const [taskTypeOpen, setTaskTypeOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { projects, addTimeEntry } = useProjects();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectId) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive"
      });
      return;
    }

    if (!hours || isNaN(Number(hours)) || Number(hours) <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid hours",
        variant: "destructive"
      });
      return;
    }

    const selectedTaskType = taskTypes.find(type => type.value === taskType);

    addTimeEntry({
      project_id: projectId,
      hours: Number(hours),
      description: selectedTaskType?.label || 'Development',
      date
    });

    toast({
      title: "Success",
      description: "Time entry added successfully!"
    });

    // Reset form
    setProjectId('');
    setHours('4');
    setTaskType('development');
    setDate(new Date().toISOString().split('T')[0]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Log Time</DialogTitle>
          <DialogDescription>
            Add time spent on a project.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project" className="text-sm font-medium">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span>{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-4">
            <Label className="text-sm font-medium">Hours: {hours}</Label>
            <div className="px-2">
              <Slider
                value={[Number(hours)]}
                onValueChange={(value) => setHours(value[0].toString())}
                min={2}
                max={8}
                step={2}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>2h</span>
                <span>4h</span>
                <span>6h</span>
                <span>8h</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Task Type</Label>
            <Popover open={taskTypeOpen} onOpenChange={setTaskTypeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={taskTypeOpen}
                  className="w-full justify-between h-10"
                >
                  {taskType
                    ? taskTypes.find((type) => type.value === taskType)?.label
                    : "Select task type..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search task type..." />
                  <CommandList>
                    <CommandEmpty>No task type found.</CommandEmpty>
                    <CommandGroup>
                      {taskTypes.map((type) => (
                        <CommandItem
                          key={type.value}
                          value={type.value}
                          onSelect={(currentValue) => {
                            setTaskType(currentValue === taskType ? "" : currentValue);
                            setTaskTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              taskType === type.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {type.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              Log Time
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTimeDialog;
