
import React from 'react';
import { Project } from '../types';
import { Icons } from '../constants';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="relative h-48 overflow-hidden">
        <img 
          src={project.image} 
          alt={project.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-indigo-600 shadow-sm">
          {project.category}
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{project.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {project.description}
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          {project.techStack.map((tech) => (
            <span 
              key={tech} 
              className="px-2 py-1 bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider font-bold rounded"
            >
              {tech}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
          <a 
            href={project.url} 
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold text-sm transition-colors"
          >
            Ver Projeto <Icons.ExternalLink />
          </a>
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Icons.Github />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
