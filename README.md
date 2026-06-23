# 🎯 SkillPath AI

An AI-powered learning companion that gives you a clear, personalized 
path to learn any skill — in the language you're comfortable in.

## Problem Statement

Most learners waste hours sifting through outdated tutorials and 
scattered resources, with no clear sense of what to actually practice 
or build next. Language is also a barrier — most curated learning 
content assumes English fluency.

SkillPath AI solves this by giving learners a complete, structured 
path: curated resources, practice links, a roadmap, and daily practice 
— all in their preferred language.

## Features

### Language Selection
- Choose English, Hindi, or Telugu before starting
- All recommendations adapt to the selected language

### AI-Curated Resources
- Best-pick YouTube channels for the chosen skill (via YouTube API)
- Direct links to practical, free practice websites

### Learning Roadmap
- Clear step-by-step path for the skill
- A real project suggestion to build after learning, to lock in the skill

### Problem of the Day
- Daily practice problem to build consistency

## System Workflow
1. User selects preferred language
2. User enters the skill they want to learn
3. AI generates best-pick YouTube channel recommendations
4. YouTube API fetches and verifies real, direct links
5. AI generates a roadmap + suggested project
6. Daily "Problem of the Day" is generated for practice

## Technology Stack

**Frontend & Build**
- React.js
- Tailwind CSS
- Built with Lovable (AI-assisted development)

**APIs & Integration**
- YouTube Data API (for real, verified channel/video links)
- AI/LLM API (for roadmap generation, resource curation, daily problems)

## Author
Rachanasri
B.Tech CSE, SR University
