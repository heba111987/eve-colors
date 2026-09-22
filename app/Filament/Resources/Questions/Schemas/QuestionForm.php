<?php

namespace App\Filament\Resources\Questions\Schemas;

use App\Enums\Quadrant;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class QuestionForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Textarea::make('text')
                    ->required()
                    ->rows(3)
                    ->columnSpanFull(),
                Select::make('quadrant')
                    ->options(Quadrant::class)
                    ->required(),
                Toggle::make('active')
                    ->required(),
            ]);
    }
}
